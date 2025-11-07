import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get users without subscriptions first
    const users = await prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    // Get subscriptions separately to avoid BigInt serialization issues
    const usersWithSubscriptions = await Promise.all(
      users.map(async (user) => {
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
          subscriptions: subscriptions.map(sub => ({
            subscriptionId: sub.subscriptionId,
            userId: sub.userId.toString(),
            productId: sub.productId,
            status: sub.status,
            expiresAt: sub.expiresAt,
            createdAt: sub.createdAt,
            product: {
              ...sub.product,
              productId: sub.product.productId,
              price: parseFloat(sub.product.price.toString()),
              periodDays: sub.product.periodDays,
              channel: sub.product.channel ? {
                ...sub.product.channel,
                channelId: sub.product.channel.channelId.toString()
              } : null
            },
            payment: sub.payment
          }))
        }
      })
    )

    const total = await prisma.user.count({ where })

    // Filter by subscription status if provided
    let filteredUsers = usersWithSubscriptions
    if (status) {
      filteredUsers = usersWithSubscriptions.filter(user => {
        const activeSubscription = user.subscriptions.find(sub => sub.status === 'active')
        return status === 'active' ? activeSubscription : !activeSubscription
      })
    }

    return NextResponse.json({
      users: filteredUsers.map(user => ({
        telegramId: user.telegramId,
        firstName: user.firstName,
        username: user.username,
        createdAt: user.createdAt,
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { telegramId, firstName, username } = await request.json()

    if (!telegramId) {
      return NextResponse.json(
        { error: 'telegramId is required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      )
    }

    const user = await prisma.user.create({
      data: {
        telegramId: BigInt(telegramId),
        firstName: firstName || '',
        username: username || ''
      }
    })

    return NextResponse.json({ user })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const telegramId = searchParams.get('telegramId')

    if (!telegramId) {
      return NextResponse.json(
        { error: 'telegramId is required' },
        { status: 400 }
      )
    }

    // Delete user's subscriptions first
    await prisma.subscription.deleteMany({
      where: {
        user: { telegramId: BigInt(telegramId) }
      }
    })

    // Delete user
    await prisma.user.delete({
      where: { telegramId: BigInt(telegramId) }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}