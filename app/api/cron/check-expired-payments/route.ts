import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting expired payments check...')

    // Получаем все платежи в статусе pending старше 1 часа
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: 'pending',
        createdAt: {
          lt: oneHourAgo
        },
        memo: {
          contains: 'NP:'
        }
      },
      include: {
        user: true,
        product: {
          include: { channel: true }
        }
      }
    })

    console.log(`Found ${pendingPayments.length} pending payments older than 1 hour`)

    let updatedCount = 0

    for (const payment of pendingPayments) {
      try {
        // Извлекаем NOWPayments ID из memo
        const nowPaymentIdMatch = payment.memo?.match(/NP:(\d+)/)
        if (!nowPaymentIdMatch) {
          console.log(`Skipping payment ${payment.paymentId} - no NOWPayments ID found`)
          continue
        }

        const nowPaymentId = nowPaymentIdMatch[1]

        // Запрос к NOWPayments API
        const npResponse = await fetch(`https://api.nowpayments.io/v1/payment/${nowPaymentId}`, {
          method: 'GET',
          headers: {
            'x-api-key': process.env.NOWPAYMENTS_API_KEY!,
            'Content-Type': 'application/json'
          }
        })

        if (!npResponse.ok) {
          console.error(`NOWPayments API error for payment ${nowPaymentId}: ${npResponse.status}`)
          continue
        }

        const npPaymentData = await npResponse.json()
        console.log(`NOWPayments status for ${nowPaymentId}: ${npPaymentData.payment_status}`)

        // Если статус изменился
        if (npPaymentData.payment_status !== payment.status) {
          const newStatus = mapPaymentStatus(npPaymentData.payment_status)

          // Обновляем платеж
          await prisma.payment.update({
            where: { paymentId: payment.paymentId },
            data: {
              status: newStatus,
              txHash: npPaymentData.transaction_id || payment.txHash,
              memo: `${payment.memo} | Auto-checked:${new Date().toISOString()}`
            }
          })

          console.log(`Updated payment ${payment.paymentId} from ${payment.status} to ${newStatus}`)

          // Если статус изменился на failed/expired, проверяем нужно ли деактивировать подписки
          if (newStatus === 'failed' && payment.status !== 'failed') {
            // Проверяем, есть ли у пользователя ДРУГИЕ УСПЕШНЫЕ платежи на этот же продукт
            const otherSuccessfulPayments = await prisma.payment.findMany({
              where: {
                userId: payment.userId,
                productId: payment.productId,
                status: 'success',
                paymentId: {
                  not: payment.paymentId // исключаем текущий платеж
                }
              }
            })

            if (otherSuccessfulPayments.length > 0) {
              console.log(`✅ User has ${otherSuccessfulPayments.length} other successful payments for product ${payment.productId}. Keeping subscription active.`)
            } else {
              console.log(`⚠️ No other successful payments found for product ${payment.productId}. Deactivating subscription...`)

              const deactivatedSubscriptions = await prisma.subscription.updateMany({
                where: {
                  userId: payment.userId,
                  productId: payment.productId,
                  status: 'active'
                },
                data: {
                  status: 'expired',
                  updatedAt: new Date()
                }
              })

              if (deactivatedSubscriptions.count > 0) {
                console.log(`Deactivated ${deactivatedSubscriptions.count} subscriptions for payment ${payment.paymentId}`)
              }
            }
          }

          updatedCount++
        }

        // Небольшая задержка между запросами к API
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        console.error(`Error checking payment ${payment.paymentId}:`, error)
        continue
      }
    }

    console.log(`✅ Completed expired payments check. Updated ${updatedCount} payments`)

    return NextResponse.json({
      success: true,
      data: {
        checked: pendingPayments.length,
        updated: updatedCount,
        message: `Проверено ${pendingPayments.length} платежей, обновлено ${updatedCount}`
      }
    })

  } catch (error) {
    console.error('Error in expired payments check:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка проверки истекших платежей' },
      500
    )
  }
}

function mapPaymentStatus(npStatus: string): 'pending' | 'success' | 'failed' {
  switch (npStatus) {
    case 'finished':
    case 'confirmed':
      return 'success'
    case 'failed':
    case 'expired':
    case 'refunded':
      return 'failed'
    case 'waiting':
    case 'confirming':
    case 'sending':
    case 'partially_paid':
    default:
      return 'pending'
  }
}