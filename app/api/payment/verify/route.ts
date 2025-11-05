import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'
import { Address, beginCell, toNano } from '@ton/ton'
import { TonClient } from '@ton/ton'

interface VerifyPaymentRequest {
  txHash: string
  paymentId: string
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

    const body: VerifyPaymentRequest = await request.json()
    const { txHash, paymentId } = body

    if (!txHash || !paymentId) {
      return NextResponse.json(
        { success: false, error: 'Хеш транзакции и ID платежа обязательны' },
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

    // Поиск платежа
    const payment = await prisma.payment.findUnique({
      where: { paymentId },
      include: {
        user: true,
        product: {
          include: { channel: true }
        }
      }
    })

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Платеж не найден' },
        { status: 404 }
      )
    }

    if (payment.userId !== telegramId) {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    if (payment.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Платеж уже обработан' },
        { status: 400 }
      )
    }

    // Верификация транзакции через TON API
    const isValidTransaction = await verifyTonTransaction(txHash, payment)

    if (!isValidTransaction) {
      // Обновляем статус платежа как failed
      await prisma.payment.update({
        where: { paymentId },
        data: {
          status: 'failed',
          txHash
        }
      })

      return NextResponse.json(
        { success: false, error: 'Транзакция не найдена или неверная' },
        { status: 400 }
      )
    }

    // Создание подписки
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + payment.product.periodDays)

    const subscription = await prisma.subscription.create({
      data: {
        userId: payment.userId,
        productId: payment.productId,
        channelId: payment.product.channelId,
        paymentId: payment.paymentId,
        status: 'active',
        startsAt: new Date(),
        expiresAt
      }
    })

    // Добавление пользователя в Telegram канал
    try {
      await addUserToChannel(
        payment.userId.toString(),
        payment.product.channel.channelId.toString(),
        process.env.BOT_TOKEN!
      )
    } catch (error) {
      console.error('Error adding user to channel:', error)
      // Не прерываем процесс, если не удалось добавить в канал
    }

    // Обновление статуса платежа
    await prisma.payment.update({
      where: { paymentId },
      data: {
        status: 'success',
        txHash
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: subscription.subscriptionId,
        expiresAt: subscription.expiresAt,
        channelName: payment.product.channel.name
      },
      message: 'Оплата прошла успешно! Подписка активирована.'
    })
  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка верификации платежа' },
      { status: 500 }
    )
  }
}

async function verifyTonTransaction(txHash: string, payment: any): Promise<boolean> {
  try {
    // В реальном приложении здесь была бы проверка транзакции через TON API
    // Проверка суммы, получателя, memo и т.д.

    // Для примера всегда возвращаем true
    // В production нужно集成 с Toncenter API или другим TON API провайдером

    /*
    const client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TONCENTER_API_KEY
    })

    const transactions = await client.getTransactions(txHash)

    // Проверка транзакции
    if (transactions.length > 0) {
      const tx = transactions[0]
      // Проверка суммы, получателя, memo
      // ...
      return true
    }
    */

    return true
  } catch (error) {
    console.error('Error verifying TON transaction:', error)
    return false
  }
}

async function addUserToChannel(userId: string, channelId: string, botToken: string): Promise<void> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/chatMember`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: channelId,
          user_id: userId
        })
      }
    )

    const data = await response.json()

    // Если пользователь не в канале, пытаемся его добавить
    if (data.ok && data.result.status === 'left') {
      await fetch(
        `https://api.telegram.org/bot${botToken}/restrictChatMember`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: channelId,
            user_id: userId,
            permissions: {
              can_send_messages: true,
              can_send_media_messages: true,
              can_send_polls: true,
              can_send_other_messages: true,
              can_add_web_page_previews: true,
              can_change_info: false,
              can_invite_users: false,
              can_pin_messages: false
            }
          })
        }
      )
    }
  } catch (error) {
    console.error('Error managing channel membership:', error)
    throw error
  }
}