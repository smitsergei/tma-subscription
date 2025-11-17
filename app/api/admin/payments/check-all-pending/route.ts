import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'
import { createJsonResponse } from '@/lib/serialization'

export const dynamic = 'force-dynamic'

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const initData = request.headers.get('x-telegram-init-data')
  if (!initData) return false

  const urlParams = new URLSearchParams(initData)
  const userStr = urlParams.get('user')
  if (!userStr) return false

  const user = JSON.parse(decodeURIComponent(userStr))
  const telegramId = BigInt(user.id)

  // Для тестовых данных пропускаем валидацию хеша
  const isTestData = initData.includes('test_hash_for_development')
  if (!isTestData) {
    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) return false
  }

  const admin = await prisma.admin.findUnique({
    where: { telegramId }
  })

  return !!admin
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting mass check of pending payments...')

    // Проверка прав администратора
    if (!(await checkAdminAuth(request))) {
      return createJsonResponse(
        { success: false, error: 'Доступ запрещен' },
        403
      )
    }

    // Получаем все pending платежи с NP ID
    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: 'pending',
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

    console.log(`Found ${pendingPayments.length} pending payments with NOWPayments ID`)

    let checkedCount = 0
    let updatedCount = 0
    let errorCount = 0
    const results: any[] = []

    for (const payment of pendingPayments) {
      try {
        checkedCount++

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
          errorCount++
          results.push({
            paymentId: payment.paymentId,
            nowPaymentId,
            error: `API error: ${npResponse.status}`
          })
          continue
        }

        const npPaymentData = await npResponse.json()
        console.log(`NOWPayments status for ${nowPaymentId}: ${npPaymentData.payment_status}`)

        // Если статус изменился
        if (npPaymentData.payment_status !== payment.status) {
          const newStatus = mapPaymentStatus(npPaymentData.payment_status)

          // Обновляем платеж
          const updatedPayment = await prisma.payment.update({
            where: { paymentId: payment.paymentId },
            data: {
              status: newStatus,
              txHash: npPaymentData.transaction_id || payment.txHash,
              memo: `${payment.memo} | Mass-checked:${new Date().toISOString()}`
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
          results.push({
            paymentId: payment.paymentId,
            nowPaymentId,
            oldStatus: payment.status,
            newStatus: npPaymentData.payment_status,
            updated: true
          })
        } else {
          results.push({
            paymentId: payment.paymentId,
            nowPaymentId,
            status: 'unchanged',
            npStatus: npPaymentData.payment_status
          })
        }

        // Небольшая задержка между запросами к API
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        errorCount++
        console.error(`Error checking payment ${payment.paymentId}:`, error)
        results.push({
          paymentId: payment.paymentId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        continue
      }
    }

    console.log(`✅ Mass check completed. Checked: ${checkedCount}, Updated: ${updatedCount}, Errors: ${errorCount}`)

    return createJsonResponse({
      success: true,
      data: {
        checked: checkedCount,
        updated: updatedCount,
        errors: errorCount,
        results
      },
      message: `Массовая проверка завершена. Проверено: ${checkedCount}, обновлено: ${updatedCount}, ошибок: ${errorCount}`
    }, 200)

  } catch (error) {
    console.error('Error in mass payment check:', error)
    return createJsonResponse(
      { success: false, error: 'Ошибка массовой проверки платежей' },
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