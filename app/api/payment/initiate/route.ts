import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData, generatePaymentMemo } from '@/lib/utils'

interface InitiatePaymentRequest {
  productId?: string
  amount?: number
  currency?: string
  orderDescription?: string
}

function getInitData(request: NextRequest): string | null {
  const initData = request.headers.get('x-telegram-init-data')
  if (initData) return initData

  const { searchParams } = new URL(request.url)
  return searchParams.get('initData')
}

export async function POST(request: NextRequest) {
  try {
    const initData = getInitData(request)
    if (!initData) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация Telegram' },
        { status: 401 }
      )
    }

    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return NextResponse.json(
        { success: false, error: 'Неверные данные авторизации' },
        { status: 401 }
      )
    }

    const body: InitiatePaymentRequest = await request.json()
    const { productId, amount, currency = 'USDT', orderDescription } = body

    // Получение пользователя из initData
    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')
    if (!userStr) {
      return NextResponse.json(
        { success: false, error: 'Не удалось получить данные пользователя' },
        { status: 400 }
      )
    }

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    // Создание или обновление пользователя
    await prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName: user.first_name,
        username: user.username
      },
      create: {
        telegramId,
        firstName: user.first_name,
        username: user.username
      }
    })

    let finalAmount: number
    let finalProductId: string | null = null

    // Если указан productId, используем данные продукта
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { productId },
        include: { channel: true }
      })

      if (!product || !product.isActive) {
        return NextResponse.json(
          { success: false, error: 'Продукт не найден или неактивен' },
          { status: 404 }
        )
      }

      finalProductId = productId
      finalAmount = product.discountPrice && product.discountPrice < product.price
        ? product.discountPrice
        : product.price
    } else if (amount) {
      // Если указана прямая сумма
      finalAmount = amount
    } else {
      return NextResponse.json(
        { success: false, error: 'Необходимо указать productId или amount' },
        { status: 400 }
      )
    }

    // Генерация уникального memo для платежа
    const memo = generatePaymentMemo()

    // Создание платежа в нашей базе данных
    const payment = await prisma.payment.create({
      data: {
        userId: telegramId,
        productId: finalProductId || 'custom',
        amount: finalAmount,
        currency,
        status: 'pending',
        memo
      }
    })

    // Создание платежа в NOWPayments
    const nowPaymentsResponse = await createNOWPayment(
      finalAmount,
      currency,
      payment.paymentId,
      orderDescription
    )

    return NextResponse.json({
      success: true,
      payment: nowPaymentsResponse
    })
  } catch (error) {
    console.error('Error initiating payment:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка инициализации платежа' },
      { status: 500 }
    )
  }
}

async function createNOWPayment(
  amount: number,
  currency: string,
  localPaymentId: string,
  orderDescription?: string
) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY
  if (!apiKey) {
    throw new Error('NOWPayments API ключ не настроен')
  }

  // Генерация URL для IPN callbacks
  const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const ipnCallbackUrl = `${baseUrl}/api/payment/nowpayments-webhook`

  // Генерация URL для редиректа после успешной оплаты
  const successUrl = `${baseUrl}/payment/success?payment_id=${localPaymentId}`

  const payload = {
    price_amount: amount,
    price_currency: 'USD', // ALWAYS USD как указано в документации
    pay_currency: currency,
    ipn_callback_url: ipnCallbackUrl,
    order_id: localPaymentId,
    order_description: orderDescription || `Payment ${amount} USD`,
    success_url: successUrl,
    partially_paid_url: successUrl
  }

  console.log('📡 Creating NOWPayment with payload:', payload)

  const response = await fetch('https://api.nowpayments.io/v1/payment', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ NOWPayments API error:', response.status, errorText)
    throw new Error(`NOWPayments API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log('✅ NOWPayment created:', data)

  return data
}