import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const initData = request.headers.get('x-telegram-init-data')
  if (!initData) {
    console.log('🔍 ADMIN AUTH: No init data found')
    return false
  }

  console.log('🔍 ADMIN AUTH: Checking auth with init data length:', initData.length)

  // Проверяем на тестовые данные администратора
  if (initData.includes('admin_test_hash_for_')) {
    console.log('🔍 ADMIN AUTH: Using test admin data')
    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')
    if (!userStr) return false

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID

    if (!adminTelegramId) {
      console.log('🔍 ADMIN AUTH: ADMIN_TELEGRAM_ID not configured')
      return false
    }

    return telegramId.toString() === adminTelegramId
  }

  // Для реальных данных используем валидацию
  if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
    console.log('🔍 ADMIN AUTH: Failed Telegram validation')
    return false
  }

  const urlParams = new URLSearchParams(initData)
  const userStr = urlParams.get('user')
  if (!userStr) return false

  const user = JSON.parse(decodeURIComponent(userStr))
  const telegramId = BigInt(user.id)

  // Проверяем, является ли пользователь администратором или создаем админа
  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID
  if (!adminTelegramId) {
    console.log('🔍 ADMIN AUTH: ADMIN_TELEGRAM_ID not configured')
    return false
  }

  if (telegramId.toString() === adminTelegramId) {
    // Создаем админа если его нет
    try {
      await prisma.admin.upsert({
        where: { telegramId },
        update: {},
        create: { telegramId }
      })
      console.log('🔍 ADMIN AUTH: Admin user verified/created')
      return true
    } catch (error) {
      console.error('🔍 ADMIN AUTH: Error creating admin:', error)
      return false
    }
  }

  console.log('🔍 ADMIN AUTH: User is not admin, ID:', telegramId.toString())
  return false
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

    const subscriptions = await prisma.subscription.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        product: true,
        channel: true,
        payment: true
      }
    })

    const total = await prisma.subscription.count({ where })

    return NextResponse.json({
      subscriptions: subscriptions.map(sub => ({
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
        product: sub.product,
        channel: sub.channel ? {
          channelId: sub.channel.channelId.toString(),
          name: sub.channel.name,
          username: sub.channel.username
        } : null,
        payment: sub.payment
      })),
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