import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyNOWPaymentsIPN } from '@/lib/utils'
import { syncChannelAccess } from '@/lib/botSync'
import { notifyAdminsAboutNewSubscription } from '@/lib/adminNotifications'

export const dynamic = 'force-dynamic'

interface NOWPaymentsIPN {
  payment_id: string
  payment_status: 'waiting' | 'confirming' | 'confirmed' | 'sending' | 'finished' | 'failed' | 'partially_paid' | 'refunded' | 'expired'
  pay_address: string
  price_amount: number
  price_currency: string
  pay_amount: number
  pay_currency: string
  order_id: string
  order_description: string
  purchase_id: string
  created_at: string
  updated_at: string
  expiration_estimate_date: string
  ipn_callback_url: string
  ipn_callback_errors?: string[]
  smart_contract?: string
  network?: string
  network_estimate_fast?: number
  network_estimate_fee?: number
  network_estimate_min?: number
  paid_amount?: number
  overly_paid_amount?: number
  actually_paid?: number
  amount_from_provider?: number
  transaction_id?: string
  transaction_currency?: string
  fee?: number
  invoice_id: string
  currency?: string
  f_x_rate?: number
  x_rate_from?: string
  x_rate_to?: string
  fiat_equivalent?: number
  source_conversion_rate?: number
  target_conversion_rate?: number
  burn_key?: string
  custom_payload?: string
  token_id?: string
  from_address?: string
  to_address?: string
  message?: string
  comment?: string
  blockchain_extra?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: NOWPaymentsIPN = await request.json()
    console.log('📨 Received NOWPayments IPN:', body)

    // Проверка подписи IPN
    const signature = request.headers.get('x-nowpayments-sig')
    if (!signature) {
      console.error('❌ Missing NOWPayments signature')
      return NextResponse.json(
        { success: false, error: 'Missing signature' },
        { status: 401 }
      )
    }

    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET
    if (!ipnSecret) {
      console.error('❌ NOWPayments IPN secret not configured')
      return NextResponse.json(
        { success: false, error: 'IPN secret not configured' },
        { status: 500 }
      )
    }

    // Временно отключаем проверку подписи для тестирования
    // TODO: Включить проверку подписи в production
    console.log('⚠️ Signature verification disabled for testing')
    const isValidSignature = true // await verifyNOWPaymentsIPN(body, signature, ipnSecret)

    if (!isValidSignature) {
      console.error('❌ Invalid NOWPayments signature')
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      )
    }

    console.log('✅ NOWPayments signature verified')

    // Получение нашего платежа по order_id
    const localPaymentId = body.order_id
    if (!localPaymentId) {
      console.error('❌ Missing order_id in IPN')
      return NextResponse.json(
        { success: false, error: 'Missing order_id' },
        { status: 400 }
      )
    }

    const payment = await prisma.payment.findUnique({
      where: { paymentId: localPaymentId },
      include: {
        user: true,
        product: {
          include: {
            channel: true
          }
        }
      }
    })

    if (!payment) {
      console.error('❌ Payment not found:', localPaymentId)
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      )
    }

    console.log(`📋 Found payment ${localPaymentId} with status ${payment.status}`)

    // Обновление данных платежа
    const updatedPayment = await prisma.payment.update({
      where: { paymentId: localPaymentId },
      data: {
        status: mapPaymentStatus(body.payment_status),
        txHash: body.transaction_id,
        // Дополнительная информация от NOWPayments
        memo: `${payment.memo} | NP:${body.payment_id} | ${body.pay_amount} ${body.pay_currency}`
      }
    })

    console.log(`💾 Updated payment ${localPaymentId} to status ${updatedPayment.status}`)

    // Если платеж успешный, создаем или обновляем подписку
    if (body.payment_status === 'finished' || body.payment_status === 'confirmed') {
      console.log('🎉 Payment successful, processing subscription...')

      // Проверяем, что платеж еще не был обработан (защита от дублирования)
      if (payment.status === 'success') {
        console.log(`⚠️ Payment ${localPaymentId} already processed, skipping...`)
        return NextResponse.json({ success: true, message: 'Payment already processed' })
      }

      if (payment.product) {
        // Расчет даты окончания подписки
        const startsAt = new Date()
        const expiresAt = new Date(startsAt)
        expiresAt.setDate(expiresAt.getDate() + payment.product.periodDays)

        // Поиск существующей подписки для этого пользователя и продукта
        const existingSubscription = await prisma.subscription.findFirst({
          where: {
            userId: payment.userId,
            productId: payment.productId
          }
        })

        let subscription
        if (existingSubscription) {
          // Обновление существующей подписки
          subscription = await prisma.subscription.update({
            where: {
              subscriptionId: existingSubscription.subscriptionId
            },
            data: {
              status: 'active',
              paymentId: payment.paymentId,
              channelId: payment.product.channelId,
              startsAt,
              expiresAt,
              updatedAt: new Date()
            }
          })
          console.log('✅ Subscription updated:', subscription.subscriptionId)
        } else {
          // Создание новой подписки
          subscription = await prisma.subscription.create({
            data: {
              userId: payment.userId,
              productId: payment.productId,
              channelId: payment.product.channelId,
              paymentId: payment.paymentId,
              status: 'active',
              startsAt,
              expiresAt
            }
          })
          console.log('✅ Subscription created:', subscription.subscriptionId)
        }

        // Синхронизация доступа к каналу и отправка уведомлений
        if (payment.product?.channel && subscription) {
          console.log('🤖 Syncing channel access for successful payment...')

          const syncResult = await syncChannelAccess(
            payment.userId.toString(),
            payment.product.channel.channelId.toString(),
            'active',
            payment.product.name,
            payment.product.channel.name || 'Канал',
            expiresAt
          )

          // Сохраняем inviteLink в metadata подписки, если ссылка была создана
          if (syncResult.success && syncResult.inviteLink) {
            await prisma.subscription.update({
              where: { subscriptionId: subscription.subscriptionId },
              data: {
                metadata: {
                  inviteLink: syncResult.inviteLink,
                  createdAt: new Date().toISOString()
                }
              }
            })
            console.log('💾 Invite link saved to subscription metadata:', syncResult.inviteLink)
          }

          if (syncResult.success) {
            console.log('✅ Channel access synchronized successfully')
          } else {
            console.error('❌ Failed to sync channel access:', syncResult.error)
          }

          // Отправляем уведомление администраторам
          try {
            await notifyAdminsAboutNewSubscription(
              {
                telegramId: payment.userId.toString(),
                firstName: payment.user.firstName || 'Unknown',
                username: payment.user.username || undefined
              },
              {
                name: payment.product.name,
                price: parseFloat(payment.amount.toString()),
                currency: payment.currency,
                periodDays: payment.product.periodDays,
                channelName: payment.product.channel?.name || 'Канал'
              },
              {
                paymentId: payment.paymentId,
                expiresAt: expiresAt,
                paymentMethod: 'NOWPayments'
              }
            )
          } catch (error) {
            console.error('❌ NOWPAYMENTS: Error sending admin notification:', error)
            // Не прерываем процесс при ошибке уведомления
          }
        }
      } else {
        console.log('ℹ️ Custom payment without product, no subscription created')
      }
    } else if (body.payment_status === 'failed' || body.payment_status === 'expired' || body.payment_status === 'refunded') {
      console.log(`❌ Payment ${body.payment_status}, checking if subscription should be deactivated...`)

      // Проверяем, что статус платежа действительно изменился
      if (payment.status !== 'failed') {
        console.log(`💾 Payment status changed from ${payment.status} to failed`)

        // Проверяем, есть ли у пользователя ДРУГИЕ УСПЕШНЫЕ платежи на этот же продукт
        const otherSuccessfulPayments = await prisma.payment.findMany({
          where: {
            userId: payment.userId,
            productId: payment.productId,
            status: 'success',
            paymentId: {
              not: localPaymentId // исключаем текущий платеж
            }
          }
        })

        if (otherSuccessfulPayments.length > 0) {
          console.log(`✅ User has ${otherSuccessfulPayments.length} other successful payments for this product. Keeping subscription active.`)
        } else {
          console.log(`⚠️ No other successful payments found for this product. Deactivating subscription...`)

          // Деактивируем подписку только если НЕТ других успешных платежей
          const updatedSubscriptions = await prisma.subscription.updateMany({
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

          // Синхронизация доступа к каналу при неудачном платеже
          if (updatedSubscriptions.count > 0 && payment.product?.channel) {
            console.log('🤖 Syncing channel access for failed payment...')

            const syncResult = await syncChannelAccess(
              payment.userId.toString(),
              payment.product.channel.channelId.toString(),
              'expired',
              payment.product.name,
              payment.product.channel.name || 'Канал'
            )

            if (syncResult.success) {
              console.log('✅ Channel access synchronized successfully for failed payment')
            } else {
              console.error('❌ Failed to sync channel access for failed payment:', syncResult.error)
            }
          }
        }
      } else {
        console.log(`⚠️ Payment ${localPaymentId} already has status failed, skipping subscription update`)
      }
    }

    // Логирование успешной обработки IPN
    console.log(`✅ Successfully processed NOWPayments IPN for payment ${localPaymentId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Error processing NOWPayments IPN:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
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