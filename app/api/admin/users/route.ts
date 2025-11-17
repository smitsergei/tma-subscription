import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// Утилита для безопасной сериализации BigInt
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}

// Функция для создания аутентифицированного ответа
function createJsonResponse(data: any, status: number = 200): NextResponse {
  return new NextResponse(safeStringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const initData = request.headers.get('x-telegram-init-data')
  if (!initData) return false

  const urlParams = new URLSearchParams(initData)
  const userStr = urlParams.get('user')
  if (!userStr) return false

  const user = JSON.parse(decodeURIComponent(userStr))
  const telegramId = BigInt(user.id)

  // Для тестовых данных пропускаем валидацию хеша
  const isTestData = initData.includes('test_hash_for_development')
  if (!isTestData) {
    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) return false
  }

  const admin = await prisma.admin.findUnique({
    where: { telegramId }
  })

  return !!admin
}

export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return createJsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const userType = searchParams.get('userType') // 'admin' | 'user' | ''

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Filter by user type (admin/user)
    if (userType === 'admin') {
      where.admin = {
        isNot: null
      }
    } else if (userType === 'user') {
      where.admin = null
    }

    // Build subscription status filter for database-level filtering
    const subscriptionFilter: any = {}
    if (status === 'active') {
      subscriptionFilter.some = { status: 'active' }
    } else if (status === 'inactive') {
      // Для "без подписок" будем фильтровать на уровне приложения после получения
      // так как Prisma не поддерживает "NOT EXISTS" напрямую
    }

    // Combine where clause with subscription filter
    const enhancedWhere = {
      ...where,
      ...(status === 'active' && { subscriptions: subscriptionFilter })
    }

    // Get users with their subscriptions and admin status for proper filtering
    let users = await prisma.user.findMany({
      where: enhancedWhere,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: true,
        subscriptions: {
          select: {
            subscriptionId: true,
            userId: true,
            productId: true,
            status: true,
            expiresAt: true,
            createdAt: true,
            product: {
              select: {
                productId: true,
                name: true,
                price: true,
                periodDays: true,
                channel: {
                  select: {
                    channelId: true,
                    name: true,
                    username: true
                  }
                }
              }
            },
            payment: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    // For inactive status, we need to get users without active subscriptions
    if (status === 'inactive') {
      // Сначала получаем ID пользователей с активными подписками
      const usersWithActiveSubs = await prisma.user.findMany({
        where: {
          ...where,
          subscriptions: {
            some: {
              status: 'active'
            }
          }
        },
        select: {
          telegramId: true
        }
      })

      const activeUserIds = usersWithActiveSubs.map(u => u.telegramId)

      // Получаем пользователей без активных подписок
      users = await prisma.user.findMany({
        where: {
          ...where,
          telegramId: {
            notIn: activeUserIds
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: true,
          subscriptions: {
            select: {
              subscriptionId: true,
              userId: true,
              productId: true,
              status: true,
              expiresAt: true,
              createdAt: true,
              product: {
                select: {
                  productId: true,
                  name: true,
                  price: true,
                  periodDays: true,
                  channel: {
                    select: {
                      channelId: true,
                      name: true,
                      username: true
                    }
                  }
                }
              },
              payment: true
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    }

    // No additional filtering needed since we filtered at database level
    let filteredUsers = users

    // Transform data for response (BigInt serialization)
    const usersWithSubscriptions = await Promise.all(
      filteredUsers.map(async (user) => {
        // Get full subscription data if needed (to ensure we have all product details)
        const subscriptions = await prisma.subscription.findMany({
          where: { userId: user.telegramId },
          include: {
            product: {
              select: {
                productId: true,
                name: true,
                price: true,
                periodDays: true,
                channel: {
                  select: {
                    channelId: true,
                    name: true,
                    username: true
                  }
                }
              }
            },
            payment: true
          },
          orderBy: { createdAt: 'desc' }
        })

        return {
          ...user,
          telegramId: user.telegramId.toString(),
          isAdmin: !!user.admin,
          subscriptions: subscriptions.map(sub => ({
            subscriptionId: sub.subscriptionId,
            userId: sub.userId.toString(),
            productId: sub.productId,
            status: sub.status,
            expiresAt: sub.expiresAt,
            createdAt: sub.createdAt,
            product: sub.product ? {
              productId: sub.product.productId,
              name: sub.product.name,
              price: parseFloat(sub.product.price.toString()),
              periodDays: sub.product.periodDays,
              channel: sub.product.channel ? {
                channelId: sub.product.channel.channelId.toString(),
                name: sub.product.channel.name,
                username: sub.product.channel.username
              } : null
            } : null,
            payment: sub.payment ? {
              paymentId: sub.payment.paymentId,
              userId: sub.payment.userId.toString(),
              productId: sub.payment.productId,
              amount: parseFloat(sub.payment.amount.toString()),
              currency: sub.payment.currency,
              status: sub.payment.status,
              txHash: sub.payment.txHash,
              memo: sub.payment.memo,
              nowPaymentId: sub.payment.nowPaymentId,
              payAddress: sub.payment.payAddress,
              payAmount: sub.payment.payAmount ? parseFloat(sub.payment.payAmount.toString()) : null,
              payCurrency: sub.payment.payCurrency,
              network: sub.payment.network,
              validUntil: sub.payment.validUntil,
              priceAmount: sub.payment.priceAmount ? parseFloat(sub.payment.priceAmount.toString()) : null,
              priceCurrency: sub.payment.priceCurrency,
              orderDescription: sub.payment.orderDescription,
              createdAt: sub.payment.createdAt,
              updatedAt: sub.payment.updatedAt
            } : null
          }))
        }
      })
    )

    // For accurate counting, we need to get total count based on status filter
    let total
    if (status === 'active') {
      // Count users with at least one active subscription
      total = await prisma.user.count({
        where: {
          ...where,
          subscriptions: {
            some: {
              status: 'active'
            }
          }
        }
      })
    } else if (status === 'inactive') {
      // Count users with no active subscriptions
      // First get users with any active subscriptions
      const usersWithActiveSubs = await prisma.user.findMany({
        where: {
          ...where,
          subscriptions: {
            some: {
              status: 'active'
            }
          }
        },
        select: {
          telegramId: true
        }
      })

      const activeUserIds = usersWithActiveSubs.map(u => u.telegramId)

      // Count users that don't have active subscriptions
      total = await prisma.user.count({
        where: {
          ...where,
          telegramId: {
            notIn: activeUserIds.length > 0 ? activeUserIds : [BigInt(0)] // Избегаем пустого массива
          }
        }
      })
    } else {
      total = await prisma.user.count({ where })
    }

    return createJsonResponse({
      users: usersWithSubscriptions.map(user => ({
        telegramId: user.telegramId,
        firstName: user.firstName,
        username: user.username,
        createdAt: user.createdAt,
        isAdmin: user.isAdmin,
        subscriptions: user.subscriptions
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching users:', error)
    return createJsonResponse(
      { error: 'Internal server error' },
      500
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return createJsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { telegramId, firstName, username } = await request.json()

    if (!telegramId) {
      return createJsonResponse(
        { error: 'telegramId is required' },
        400
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) }
    })

    if (existingUser) {
      return createJsonResponse(
        { error: 'User already exists' },
        409
      )
    }

    const user = await prisma.user.create({
      data: {
        telegramId: BigInt(telegramId),
        firstName: firstName || '',
        username: username || ''
      }
    })

    // Конвертируем BigInt в string для ответа
    const serializedUser = {
      telegramId: user.telegramId.toString(),
      firstName: user.firstName,
      username: user.username,
      createdAt: user.createdAt
    }

    return createJsonResponse({ user: serializedUser })

  } catch (error) {
    console.error('Error creating user:', error)
    return createJsonResponse(
      { error: 'Internal server error' },
      500
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return createJsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { telegramId, isAdmin } = await request.json()

    if (!telegramId || typeof isAdmin !== 'boolean') {
      return createJsonResponse(
        { error: 'telegramId and isAdmin (boolean) are required' },
        400
      )
    }

    const userId = BigInt(telegramId)

    if (isAdmin) {
      // Добавить администратора
      await prisma.admin.upsert({
        where: { telegramId: userId },
        update: {},
        create: { telegramId: userId }
      })
    } else {
      // Удалить администратора
      await prisma.admin.delete({
        where: { telegramId: userId }
      }).catch(() => {
        // Игнорируем ошибку если администратор не существует
      })
    }

    return createJsonResponse({
      success: true,
      message: isAdmin ? 'User promoted to admin' : 'Admin privileges revoked'
    })

  } catch (error) {
    console.error('Error updating user admin status:', error)
    return createJsonResponse(
      { error: 'Internal server error' },
      500
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return createJsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { searchParams } = new URL(request.url)
    const telegramId = searchParams.get('telegramId')

    if (!telegramId) {
      return createJsonResponse(
        { error: 'telegramId is required' },
        400
      )
    }

    // Удаляем все связанные записи в правильном порядке
    const userId = BigInt(telegramId)

    // 1. Удаляем использования промокодов
    await prisma.promoUsage.deleteMany({
      where: { userId }
    })

    // 2. Удаляем использования скидок
    await prisma.discountUsage.deleteMany({
      where: { userId }
    })

    // 3. Удаляем демо-доступ
    await prisma.demoAccess.deleteMany({
      where: { userId }
    })

    // 4. Удаляем подписки
    await prisma.subscription.deleteMany({
      where: { userId }
    })

    // 5. Удаляем платежи
    await prisma.payment.deleteMany({
      where: { userId }
    })

    // 6. Удаляем админские права, если есть
    await prisma.admin.deleteMany({
      where: { telegramId: userId }
    })

    // 7. Удаляем пользователя
    await prisma.user.delete({
      where: { telegramId: userId }
    })

    return createJsonResponse({ success: true })

  } catch (error) {
    console.error('Error deleting user:', error)
    return createJsonResponse(
      { error: 'Internal server error' },
      500
    )
  }
}