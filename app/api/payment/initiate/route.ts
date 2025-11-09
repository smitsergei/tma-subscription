import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData, generatePaymentMemo } from '@/lib/utils'
import { Address, beginCell, toNano } from '@ton/ton'

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

    // Расчет суммы для транзакции (в наноTON для комиссии)
    const commissionInNanoTON = toNano('0.1') // Комиссия сети ~0.1 TON

    // Для USDT используем jetton transfer
    // Адрес USDT в TON сети
    const usdtMasterAddress = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'

    // Создаем payload для jetton transfer с memo
    const jettonTransferPayload = beginCell()
      .storeUint(0xf8a7ea5, 32) // op code для jetton transfer
      .storeUint(0, 64) // query_id
      .storeCoins(toNano((Number(finalPrice) * 1000000).toString())) // USDT amount (6 decimals)
      .storeAddress(Address.parse(process.env.TON_WALLET_ADDRESS!)) // destination
      .storeAddress(Address.parse(process.env.TON_WALLET_ADDRESS!)) // response_destination
      .storeUint(0, 1) // custom_payload
      .storeCoins(toNano('0.001')) // forward_ton_amount
      .storeUint(1, 1) // forward_payload type (cell)
      .storeUint(0, 32) // flags для text comment
      .storeBuffer(Buffer.from(memo, 'utf8')) // comment с memo как buffer
      .endCell()

    console.log('💰 PAYMENT INITIATE: USDT Payment details:', {
      paymentId: payment.paymentId,
      amount: finalPrice,
      currency: 'USDT',
      memo,
      usdtAmount: (Number(finalPrice) * 1000000).toString(),
      commission: commissionInNanoTON.toString()
    })

    return NextResponse.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        amount: finalPrice.toString(),
        currency: 'USDT',
        memo,
        walletAddress: process.env.TON_WALLET_ADDRESS,
        // Данные для транзакции TON Connect (USDT jetton transfer)
        transaction: {
          messages: [
            {
              address: usdtMasterAddress,
              amount: commissionInNanoTON.toString(),
              payload: jettonTransferPayload.toBoc().toString('base64')
            }
          ]
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