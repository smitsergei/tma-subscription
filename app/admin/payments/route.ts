import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  console.log('🔍 AUTH: Starting admin authentication check')

  const initData = request.headers.get('x-telegram-init-data')
  console.log('🔍 AUTH: Init data present:', !!initData)

  if (!initData) {
    console.log('🔍 AUTH: No init data found')
    return false
  }

  console.log('🔍 AUTH: Validating init data...')
  if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
    console.log('🔍 AUTH: Init data validation failed')
    return false
  }
  console.log('🔍 AUTH: Init data validation passed')

  const urlParams = new URLSearchParams(initData)
  const userStr = urlParams.get('user')
  console.log('🔍 AUTH: User string present:', !!userStr)

  if (!userStr) {
    console.log('🔍 AUTH: No user data in init data')
    return false
  }

  const user = JSON.parse(decodeURIComponent(userStr))
  const telegramId = BigInt(user.id)

  console.log('🔍 AUTH: Checking admin status for user:', telegramId.toString())

  const admin = await prisma.admin.findUnique({
    where: { telegramId }
  })

  if (!admin) {
    console.log('🔍 AUTH: User not found in admins table')
    return false
  }

  console.log('🔍 AUTH: Admin access granted for:', telegramId.toString())
  return true
}

// GET - получение всех платежей с фильтрацией
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 ADMIN PAYMENTS: Starting GET request')

    // Проверка прав администратора
    if (!(await checkAdminAuth(request))) {
      console.log('🔍 ADMIN PAYMENTS: Admin authentication failed')
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')
    const productId = searchParams.get('productId')
    const search = searchParams.get('search')

    const skip = (page - 1) * limit

    // Построение условий фильтрации
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (userId) {
      where.userId = BigInt(userId)
    }

    if (productId) {
      where.productId = productId
    }

    if (search) {
      where.OR = [
        { memo: { contains: search, mode: 'insensitive' } },
        { paymentId: { contains: search, mode: 'insensitive' } },
        { txHash: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Получение платежей
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.payment.count({ where })
    ])

    // Конвертация BigInt в строки
    const formattedPayments = payments.map(payment => ({
      ...payment,
      userId: payment.userId.toString(),
      user: payment.user ? {
        ...payment.user,
        telegramId: payment.user.telegramId.toString()
      } : null,
      product: payment.product ? {
        ...payment.product,
        channel: payment.product.channel ? {
          ...payment.product.channel,
          channelId: payment.product.channel.channelId.toString()
        } : null
      } : null
    }))

    // Статистика
    const stats = await prisma.payment.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    })

    const statusStats = {
      total: await prisma.payment.count(),
      pending: stats.find(s => s.status === 'pending')?._count.status || 0,
      success: stats.find(s => s.status === 'success')?._count.status || 0,
      failed: stats.find(s => s.status === 'failed')?._count.status || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        payments: formattedPayments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        stats: statusStats
      }
    })

  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка получения платежей' },
      { status: 500 }
    )
  }
}

// POST - ручное управление платежом
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 ADMIN PAYMENTS: Starting POST request')

    // Проверка прав администратора
    if (!(await checkAdminAuth(request))) {
      console.log('🔍 ADMIN PAYMENTS: Admin authentication failed')
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { paymentId, action, txHash, notes } = body

    if (!paymentId || !action) {
      return NextResponse.json(
        { success: false, error: 'Payment ID и action обязательны' },
        { status: 400 }
      )
    }

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

    let updatedPayment

    switch (action) {
      case 'confirm':
        // Ручное подтверждение платежа
        if (payment.status !== 'pending') {
          return NextResponse.json(
            { success: false, error: 'Платеж уже обработан' },
            { status: 400 }
          )
        }

        // Создание подписки
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + payment.product.periodDays)

        const subscription = await prisma.$transaction(async (tx) => {
          // Обновление статуса платежа
          const updatedPayment = await tx.payment.update({
            where: { paymentId },
            data: {
              status: 'success',
              txHash: txHash || payment.txHash
            }
          })

          // Создание подписки
          const newSubscription = await tx.subscription.create({
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

          return { updatedPayment, subscription: newSubscription }
        })

        updatedPayment = subscription.updatedPayment

        // Отправка уведомления пользователю
        try {
          const message = `✅ <b>Оплата подтверждена администратором!</b>

📦 <b>Подписка:</b> ${payment.product.name}
📢 <b>Канал:</b> ${payment.product.channel.name}
⏰ <b>Действует до:</b> ${expiresAt.toLocaleDateString('ru-RU')}

Ваша подписка активирована.`

          await fetch(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: payment.userId.toString(),
                text: message,
                parse_mode: 'HTML'
              })
            }
          )
        } catch (notifyError) {
          console.error('Error sending notification:', notifyError)
        }

        break

      case 'reject':
        // Отклонение платежа
        if (payment.status !== 'pending') {
          return NextResponse.json(
            { success: false, error: 'Платеж уже обработан' },
            { status: 400 }
          )
        }

        updatedPayment = await prisma.payment.update({
          where: { paymentId },
          data: {
            status: 'failed',
            txHash: txHash || payment.txHash
          }
        })

        // Отправка уведомления об отклонении
        try {
          const message = `❌ <b>Платеж отклонен</b>

Платеж на сумму ${payment.amount} ${payment.currency} был отклонен администратором.

Если у вас есть вопросы, пожалуйста, свяжитесь с поддержкой.`

          await fetch(
            `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: payment.userId.toString(),
                text: message,
                parse_mode: 'HTML'
              })
            }
          )
        } catch (notifyError) {
          console.error('Error sending rejection notification:', notifyError)
        }

        break

      case 'reset':
        // Сброс статуса в pending
        if (payment.status === 'pending') {
          return NextResponse.json(
            { success: false, error: 'Платеж уже в статусе pending' },
            { status: 400 }
          )
        }

        updatedPayment = await prisma.payment.update({
          where: { paymentId },
          data: {
            status: 'pending',
            txHash: null
          }
        })

        break

      default:
        return NextResponse.json(
          { success: false, error: 'Неизвестное действие' },
          { status: 400 }
        )
    }

    // Логирование действия администратора
    console.log(`🔧 ADMIN: Payment ${paymentId} ${action}ed by admin`)

    return NextResponse.json({
      success: true,
      data: {
        payment: {
          ...updatedPayment,
          userId: updatedPayment.userId.toString()
        },
        message: `Платеж успешно ${action === 'confirm' ? 'подтвержден' : action === 'reject' ? 'отклонен' : 'сброшен'}`
      }
    })

  } catch (error) {
    console.error('Error managing payment:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка управления платежом' },
      { status: 500 }
    )
  }
}