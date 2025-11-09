import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData, generatePaymentMemo } from '@/lib/utils'
import { Decimal } from 'decimal.js'

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

// Функция для определения сети по коду валюты
function getNetworkFromCurrency(currency: string): string {
  switch (currency) {
    case 'USDTTRC20':
      return 'TRON (TRC20)'
    case 'USDCTRC20':
      return 'TRON (TRC20)'
    case 'USDT':
      return 'TRON (TRC20)'
    case 'USDC':
      return 'TRON (TRC20)'
    case 'BTC':
      return 'Bitcoin'
    case 'ETH':
      return 'Ethereum'
    case 'LTC':
      return 'Litecoin'
    case 'BCH':
      return 'Bitcoin Cash'
    default:
      return currency
  }
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
      finalAmount = product.discountPrice && Number(product.discountPrice) < Number(product.price)
        ? Number(product.discountPrice)
        : Number(product.price)
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
    // Если productId не указан, это платеж без привязки к продукту
    const payment = await prisma.payment.create({
      data: {
        userId: telegramId,
        productId: finalProductId || null, // null для платежей без продукта
        amount: finalAmount,
        currency,
        status: 'pending',
        memo
      }
    })

  // Получаем базовый URL для редиректов
    const baseUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

    // Создание платежа в NOWPayments
    const nowPaymentsResponse = await createNOWPayment(
      finalAmount,
      currency,
      payment.paymentId,
      orderDescription
    )

    console.log('💰 PAYMENT INITIATE: NOWPayments details:', {
      paymentId: payment.paymentId,
      amount: finalAmount,
      currency: currency,
      memo
    })

    // Сохраняем все детали NOWPayments в платеже
    await prisma.payment.update({
      where: { paymentId: payment.paymentId },
      data: {
        nowPaymentId: nowPaymentsResponse.payment_id?.toString(),
        payAddress: nowPaymentsResponse.pay_address,
        payAmount: nowPaymentsResponse.pay_amount ? new Decimal(nowPaymentsResponse.pay_amount.toString()) : null,
        payCurrency: nowPaymentsResponse.pay_currency,
        network: nowPaymentsResponse.network || getNetworkFromCurrency(nowPaymentsResponse.pay_currency),
        validUntil: nowPaymentsResponse.valid_until ? new Date(nowPaymentsResponse.valid_until) : null,
        priceAmount: nowPaymentsResponse.price_amount ? new Decimal(nowPaymentsResponse.price_amount.toString()) : null,
        priceCurrency: nowPaymentsResponse.price_currency,
        orderDescription: nowPaymentsResponse.order_description,
      }
    })

    console.log('💰 PAYMENT INITIATE: NOWPayments details:', {
      paymentId: payment.paymentId,
      amount: finalAmount,
      currency: currency,
      memo,
      nowPaymentId: nowPaymentsResponse.payment_id
    })

    // Возвращаем URL для перенаправления на страницу оплаты
    const paymentUrl = `${baseUrl}/payment?payment_id=${payment.paymentId}`

    return NextResponse.json({
      success: true,
      payment: {
        payment_id: nowPaymentsResponse.payment_id,
        payment_url: paymentUrl,
        pay_address: nowPaymentsResponse.pay_address,
        pay_amount: nowPaymentsResponse.pay_amount,
        pay_currency: nowPaymentsResponse.pay_currency,
        price_amount: nowPaymentsResponse.price_amount,
        price_currency: nowPaymentsResponse.price_currency,
        valid_until: nowPaymentsResponse.valid_until
      }
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

  // Проверяем минимальные суммы для разных валют
  const MIN_AMOUNTS: { [key: string]: number } = {
    'USDT': 1,  // Минимум 1 USDT
    'USDC': 1,  // Минимум 1 USDC
    'BTC': 0.00001, // Минимум для BTC
    'ETH': 0.001,   // Минимум для ETH
    'LTC': 0.01,    // Минимум для LTC
    'BCH': 0.01     // Минимум для BCH
  }

  // Проверяем и корректируем сумму если необходимо
  const minAmount = MIN_AMOUNTS[currency] || 10
  const finalAmount = Math.max(amount, minAmount)

  if (finalAmount !== amount) {
    console.log(`💰 Amount adjusted from $${amount} to $${finalAmount} for ${currency} (minimum: $${minAmount})`)
  }

  // Генерация URL для IPN callbacks
  // Используем правильный production URL
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://tma-subscription.vercel.app'
    : (process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000')
  const ipnCallbackUrl = `${baseUrl}/api/payment/nowpayments-webhook`

  // Генерация URL для редиректа после успешной оплаты
  const successUrl = `${baseUrl}/payment/success?payment_id=${localPaymentId}`

  // Используем всегда валидный callback URL
  const validCallbackUrl = ipnCallbackUrl

  console.log('🔗 URLs being used:')
  console.log('  Base URL:', baseUrl)
  console.log('  IPN Callback URL:', validCallbackUrl)
  console.log('  Success URL:', successUrl)

  // Определяем параметры для разных валют
  let priceCurrency = 'USD'
  let payCurrency = currency

  if (currency === 'USDT') {
    // Для USDT используем сеть TRON (TRC20)
    priceCurrency = 'USD' // Цена всегда в USD для USDT
    payCurrency = 'USDTTRC20' // USDT в сети TRON
  } else if (currency === 'USDC') {
    payCurrency = 'USDCTRC20' // USDC в сети TRON
  } else {
    priceCurrency = currency === 'USDT' ? 'USDT' : 'USD'
  }

  const payload = {
    price_amount: finalAmount,
    price_currency: priceCurrency,
    pay_currency: payCurrency,
    ipn_callback_url: validCallbackUrl,
    order_id: localPaymentId,
    order_description: orderDescription || `Payment ${finalAmount} ${currency}`,
    success_url: successUrl
    // Убираем partially_paid_url - он не поддерживается
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

    // Если валюта недоступна, пробуем BTC
    if (errorText.includes('CURRENCY_UNAVAILABLE') && currency !== 'BTC') {
      console.log('🔄 Currency unavailable, trying BTC as fallback...')
      return await createNOWPayment(finalAmount, 'BTC', localPaymentId, orderDescription)
    }

    throw new Error(`NOWPayments API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log('✅ NOWPayment created:', data)

  return data
}