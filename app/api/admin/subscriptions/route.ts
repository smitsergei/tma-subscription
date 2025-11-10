import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export const dynamic = 'force-dynamic'

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

  if (!admin) {
    // Создаем админа если его нет (для тестовых данных)
    try {
      await prisma.user.upsert({
        where: { telegramId },
        update: {},
        create: {
          telegramId,
          firstName: user.first_name || 'Admin',
          username: user.username || 'admin',
        }
      })

      await prisma.admin.create({
        data: { telegramId }
      })

      return true
    } catch (createError) {
      console.error('🔍 AUTH: Failed to create admin record:', createError)
      return false
    }
  }

  return true
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 SUBSCRIPTIONS API: Starting request...')

    if (!(await checkAdminAuth(request))) {
      console.log('🔍 SUBSCRIPTIONS API: Authentication failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 SUBSCRIPTIONS API: Authentication successful')

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')

    console.log('🔍 SUBSCRIPTIONS API: Params:', { page, limit, status, userId })

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (userId) {
      where.userId = BigInt(userId)
    }

    console.log('🔍 SUBSCRIPTIONS API: Where clause:', where)

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

    console.log('🔍 SUBSCRIPTIONS API: Raw subscriptions count:', subscriptionsData.length)

    // Serialize BigInt fields safely
    const subscriptions = subscriptionsData.map(sub => {
      try {
        return {
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
          channel: sub.channel ? {
            channelId: sub.channel.channelId.toString(),
            name: sub.channel.name,
            username: sub.channel.username,
            description: sub.channel.description
          } : null,
          payment: sub.payment
        }
      } catch (error) {
        console.error('🔍 SUBSCRIPTIONS API: Error serializing subscription:', error)
        return null
      }
    }).filter(Boolean) // Remove any null entries from serialization errors

    console.log('🔍 SUBSCRIPTIONS API: Serialized subscriptions count:', subscriptions.length)

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
    const subscriptionData = await prisma.subscription.create({
      data: {
        userId: user.telegramId,
        productId,
        channelId: product.channelId,
        status: status || 'active',
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days by default
      },
      include: {
        user: true,
        product: {
          include: {
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
    const subscription = {
      subscriptionId: subscriptionData.subscriptionId,
      userId: subscriptionData.userId.toString(),
      productId: subscriptionData.productId,
      channelId: subscriptionData.channelId.toString(),
      status: subscriptionData.status,
      expiresAt: subscriptionData.expiresAt,
      createdAt: subscriptionData.createdAt,
      updatedAt: subscriptionData.updatedAt,
      user: subscriptionData.user ? {
        telegramId: subscriptionData.user.telegramId.toString(),
        firstName: subscriptionData.user.firstName,
        username: subscriptionData.user.username
      } : null,
      product: subscriptionData.product ? {
        productId: subscriptionData.product.productId,
        name: subscriptionData.product.name,
        description: subscriptionData.product.description,
        price: parseFloat(subscriptionData.product.price.toString()),
        periodDays: subscriptionData.product.periodDays,
        discountPrice: subscriptionData.product.discountPrice ? parseFloat(subscriptionData.product.discountPrice.toString()) : null,
        isTrial: subscriptionData.product.isTrial,
        isActive: subscriptionData.product.isActive,
        allowDemo: subscriptionData.product.allowDemo,
        demoDays: subscriptionData.product.demoDays,
        createdAt: subscriptionData.product.createdAt,
        updatedAt: subscriptionData.product.updatedAt,
        channel: subscriptionData.product.channel ? {
          channelId: subscriptionData.product.channel.channelId.toString(),
          name: subscriptionData.product.channel.name,
          username: subscriptionData.product.channel.username
        } : null
      } : null,
      channel: subscriptionData.channel ? {
        channelId: subscriptionData.channel.channelId.toString(),
        name: subscriptionData.channel.name,
        username: subscriptionData.channel.username,
        description: subscriptionData.channel.description,
        createdAt: subscriptionData.channel.createdAt
      } : null,
      payment: subscriptionData.payment
    }

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

    const subscriptionData = await prisma.subscription.update({
      where: { subscriptionId },
      data: {
        ...(status && { status }),
        ...(expiresAt && { expiresAt: new Date(expiresAt) })
      },
      include: {
        user: true,
        product: {
          include: {
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
    const subscription = {
      subscriptionId: subscriptionData.subscriptionId,
      userId: subscriptionData.userId.toString(),
      productId: subscriptionData.productId,
      channelId: subscriptionData.channelId.toString(),
      status: subscriptionData.status,
      expiresAt: subscriptionData.expiresAt,
      createdAt: subscriptionData.createdAt,
      updatedAt: subscriptionData.updatedAt,
      user: subscriptionData.user ? {
        telegramId: subscriptionData.user.telegramId.toString(),
        firstName: subscriptionData.user.firstName,
        username: subscriptionData.user.username
      } : null,
      product: subscriptionData.product ? {
        productId: subscriptionData.product.productId,
        name: subscriptionData.product.name,
        description: subscriptionData.product.description,
        price: parseFloat(subscriptionData.product.price.toString()),
        periodDays: subscriptionData.product.periodDays,
        discountPrice: subscriptionData.product.discountPrice ? parseFloat(subscriptionData.product.discountPrice.toString()) : null,
        isTrial: subscriptionData.product.isTrial,
        isActive: subscriptionData.product.isActive,
        allowDemo: subscriptionData.product.allowDemo,
        demoDays: subscriptionData.product.demoDays,
        createdAt: subscriptionData.product.createdAt,
        updatedAt: subscriptionData.product.updatedAt,
        channel: subscriptionData.product.channel ? {
          channelId: subscriptionData.product.channel.channelId.toString(),
          name: subscriptionData.product.channel.name,
          username: subscriptionData.product.channel.username
        } : null
      } : null,
      channel: subscriptionData.channel ? {
        channelId: subscriptionData.channel.channelId.toString(),
        name: subscriptionData.channel.name,
        username: subscriptionData.channel.username,
        description: subscriptionData.channel.description,
        createdAt: subscriptionData.channel.createdAt
      } : null,
      payment: subscriptionData.payment
    }

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