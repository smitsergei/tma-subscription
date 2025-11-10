import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// Функция для получения пользователя из Telegram init data
function getUserFromRequest(request: NextRequest) {
  // Сначала пробуем получить из заголовка
  const initData = request.headers.get('x-telegram-init-data')
  if (initData) {
    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')
    if (userStr) {
      return JSON.parse(decodeURIComponent(userStr))
    }
  }

  // Если в заголовке нет, пробуем из query параметров
  const { searchParams } = new URL(request.url)
  const queryInitData = searchParams.get('initData')
  if (queryInitData) {
    const urlParams = new URLSearchParams(queryInitData)
    const userStr = urlParams.get('user')
    if (userStr) {
      return JSON.parse(decodeURIComponent(userStr))
    }
  }

  return null
}

// GET - получение платежей текущего пользователя
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401 }
      )
    }

    // Для тестовых данных пропускаем валидацию
    const initData = request.headers.get('x-telegram-init-data') ||
                   new URL(request.url).searchParams.get('initData') || ''
    const isTestData = initData.includes('test_hash_for_development')

    if (!isTestData && !validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return NextResponse.json(
        { success: false, error: 'Неверные данные авторизации' },
        { status: 401 }
      )
    }

    const telegramId = BigInt(user.id)
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')

    const skip = (page - 1) * limit

    // Построение условий фильтрации
    const where: any = {
      userId: telegramId
    }

    if (status) {
      where.status = status
    }

    // Получение платежей пользователя
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          user: {
            select: {
              telegramId: true,
              username: true,
              firstName: true
            }
          },
          product: {
            include: {
              channel: {
                select: {
                  channelId: true,
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.payment.count({ where })
    ])

    // Форматирование платежей с сериализацией BigInt
    const formattedPayments = payments.map(payment => ({
      ...payment,
      paymentId: payment.paymentId,
      userId: payment.userId.toString(),
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      memo: payment.memo,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      // NOWPayments fields
      nowPaymentId: payment.nowPaymentId,
      payAddress: payment.payAddress,
      payAmount: payment.payAmount ? Number(payment.payAmount) : null,
      payCurrency: payment.payCurrency,
      network: payment.network,
      validUntil: payment.validUntil?.toISOString(),
      priceAmount: payment.priceAmount ? Number(payment.priceAmount) : null,
      priceCurrency: payment.priceCurrency,
      orderDescription: payment.orderDescription,
      // Related data
      user: payment.user ? {
        telegramId: payment.user.telegramId.toString(),
        username: payment.user.username,
        firstName: payment.user.firstName
      } : null,
      product: payment.product ? {
        productId: payment.product.productId,
        name: payment.product.name,
        price: Number(payment.product.price),
        periodDays: payment.product.periodDays,
        channel: payment.product.channel ? {
          channelId: payment.product.channel.channelId.toString(),
          name: payment.product.channel.name
        } : null
      } : null
    }))

    return NextResponse.json({
      success: true,
      data: {
        payments: formattedPayments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('Error fetching user payments:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки платежей' },
      { status: 500 }
    )
  }
}