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
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (userId) {
      where.userId = BigInt(userId)
    }

  // Get subscriptions separately to avoid BigInt serialization issues
    const subscriptionsData = await prisma.subscription.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
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
        channel: true,
        payment: true
      }
    })

    // Serialize BigInt fields
    const subscriptions = subscriptionsData.map(sub => ({
      subscriptionId: sub.subscriptionId,
      userId: sub.userId.toString(),
      productId: sub.productId,
      channelId: sub.channelId.toString(),
      status: sub.status,
      expiresAt: sub.expiresAt,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      user: sub.user ? {
        telegramId: sub.user.telegramId.toString(),
        firstName: sub.user.firstName,
        username: sub.user.username
      } : null,
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
      channel: sub.channel ? {
        channelId: sub.channel.channelId.toString(),
        name: sub.channel.name,
        username: sub.channel.username,
        description: sub.channel.description
      } : null,
      payment: sub.payment
    }))

    const total = await prisma.subscription.count({ where })

    return NextResponse.json({
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching subscriptions:', error)
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

    const { userId, productId, status, expiresAt } = await request.json()

    if (!userId || !productId) {
      return NextResponse.json(
        { error: 'userId and productId are required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { productId }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.telegramId,
        productId,
        channelId: product.channelId,
        status: status || 'active',
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days by default
      },
      include: {
        user: true,
        product: true,
        channel: true
      }
    })

    return NextResponse.json({ subscription })

  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('id')

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'subscription id is required' },
        { status: 400 }
      )
    }

    const { status, expiresAt } = await request.json()

    const subscription = await prisma.subscription.update({
      where: { subscriptionId },
      data: {
        ...(status && { status }),
        ...(expiresAt && { expiresAt: new Date(expiresAt) })
      },
      include: {
        user: true,
        product: true
      }
    })

    return NextResponse.json({ subscription })

  } catch (error) {
    console.error('Error updating subscription:', error)
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
    const subscriptionId = searchParams.get('id')

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'subscription id is required' },
        { status: 400 }
      )
    }

    await prisma.subscription.delete({
      where: { subscriptionId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting subscription:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}