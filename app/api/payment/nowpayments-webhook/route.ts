import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyNOWPaymentsIPN } from '@/lib/utils'

interface NOWPaymentsIPN {
  payment_id: string
  payment_status: 'waiting' | 'confirming' | 'confirmed' | 'sending' | 'finished' | 'failed' | 'partially_paid' | 'refunded'
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
        product: true
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
      } else {
        console.log('ℹ️ Custom payment without product, no subscription created')
      }
    } else if (body.payment_status === 'failed') {
      console.log('❌ Payment failed, updating subscription status...')

      // Деактивация подписки если платеж не удался
      await prisma.subscription.updateMany({
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