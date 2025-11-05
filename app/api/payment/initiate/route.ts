import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData, generatePaymentMemo } from '@/lib/utils'

interface InitiatePaymentRequest {
  productId: string
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
    const { productId } = body

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'ID продукта обязателен' },
        { status: 400 }
      )
    }

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

    // Проверка существования продукта
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

    // Определение итоговой цены
    const finalPrice = product.discountPrice && product.discountPrice < product.price
      ? product.discountPrice
      : product.price

    // Генерация уникального memo для платежа
    const memo = generatePaymentMemo()

    // Создание платежа
    const payment = await prisma.payment.create({
      data: {
        userId: telegramId,
        productId,
        amount: finalPrice,
        currency: 'USDT',
        status: 'pending',
        memo
      }
    })

    // Здесь в реальном приложении нужно было бы рассчитать сумму в наноTON
    // для USDT jetton. Для примера используем простую конвертацию.
    const amountInNanoTON = (parseFloat(finalPrice.toString()) * 1000000000).toString()

    return NextResponse.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        amount: finalPrice.toString(),
        currency: 'USDT',
        memo,
        walletAddress: process.env.TON_WALLET_ADDRESS,
        // Данные для транзакции TON Connect
        transaction: {
          address: process.env.TON_WALLET_ADDRESS,
          amount: amountInNanoTON,
          payload: memo
        }
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