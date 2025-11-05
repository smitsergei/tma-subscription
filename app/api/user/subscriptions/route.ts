import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

// Получение initData из заголовка или query параметра
function getInitData(request: NextRequest): string | null {
  // Сначала проверяем заголовок
  const initData = request.headers.get('x-telegram-init-data')
  if (initData) return initData

  // Затем проверяем query параметры
  const { searchParams } = new URL(request.url)
  return searchParams.get('initData')
}

export async function GET(request: NextRequest) {
  try {
    const initData = getInitData(request)
    if (!initData) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация Telegram' },
        { status: 401 }
      )
    }

    // Валидация initData
    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return NextResponse.json(
        { success: false, error: 'Неверные данные авторизации' },
        { status: 401 }
      )
    }

    // Получение ID пользователя из initData
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

    // Получение активных подписок пользователя
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: telegramId
      },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            username: true
          }
        },
        product: {
          select: {
            productId: true,
            name: true,
            periodDays: true
          }
        },
        channel: {
          select: {
            channelId: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: subscriptions.map(subscription => ({
        ...subscription,
        userId: subscription.userId.toString(),
        productId: subscription.productId,
        channelId: subscription.channelId.toString(),
        user: subscription.user ? {
          ...subscription.user,
          telegramId: subscription.user.telegramId.toString()
        } : null,
        channel: subscription.channel ? {
          ...subscription.channel,
          channelId: subscription.channel.channelId.toString()
        } : null
      }))
    })
  } catch (error) {
    console.error('Error fetching user subscriptions:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки подписок' },
      { status: 500 }
    )
  }
}