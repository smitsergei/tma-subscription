import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const initData = request.headers.get('x-telegram-init-data')
  if (!initData) return false

  if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) return false

  const urlParams = new URLSearchParams(initData)
  const userStr = urlParams.get('user')
  if (!userStr) return false

  const user = JSON.parse(decodeURIComponent(userStr))
  const telegramId = BigInt(user.id)

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

    const products = await prisma.product.findMany({
      include: {
        channel: true,
        _count: {
          select: {
            subscriptions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ products })

  } catch (error) {
    console.error('Error fetching products:', error)
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

    const { name, description, price, channelTelegramId, periodDays, isActive } = await request.json()

    if (!name || !price || !channelTelegramId) {
      return NextResponse.json(
        { error: 'name, price, and channelTelegramId are required' },
        { status: 400 }
      )
    }

    // Find or create channel
    let channel = await prisma.channel.findUnique({
      where: { channelId: BigInt(channelTelegramId) }
    })

    if (!channel) {
      channel = await prisma.channel.create({
        data: {
          channelId: BigInt(channelTelegramId),
          name: `Channel ${channelTelegramId}`,
        }
      })
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description || '',
        price: parseFloat(price),
        channelId: channel.channelId,
        periodDays: periodDays || 30,
        isActive: isActive !== false
      },
      include: {
        channel: true
      }
    })

    return NextResponse.json({ product })

  } catch (error) {
    console.error('Error creating product:', error)
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
    const productId = searchParams.get('id')

    if (!productId) {
      return NextResponse.json(
        { error: 'product id is required' },
        { status: 400 }
      )
    }

    const { name, description, price, channelTelegramId, periodDays, isActive } = await request.json()

    // Handle channel change if provided
    let updateData: any = {}

    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (price !== undefined) updateData.price = parseFloat(price)
    if (periodDays !== undefined) updateData.periodDays = periodDays
    if (isActive !== undefined) updateData.isActive = isActive

    if (channelTelegramId) {
      let channel = await prisma.channel.findUnique({
        where: { channelId: BigInt(channelTelegramId) }
      })

      if (!channel) {
        channel = await prisma.channel.create({
          data: {
            channelId: BigInt(channelTelegramId),
            name: `Channel ${channelTelegramId}`,
          }
        })
      }

      updateData.channelId = channel.channelId
    }

    const product = await prisma.product.update({
      where: { productId },
      data: updateData,
      include: {
        channel: true
      }
    })

    return NextResponse.json({ product })

  } catch (error) {
    console.error('Error updating product:', error)
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
    const productId = searchParams.get('id')

    if (!productId) {
      return NextResponse.json(
        { error: 'product id is required' },
        { status: 400 }
      )
    }

    // Check if product has active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        productId,
        status: 'active'
      }
    })

    if (activeSubscriptions > 0) {
      return NextResponse.json(
        { error: 'Cannot delete product with active subscriptions' },
        { status: 400 }
      )
    }

    await prisma.product.delete({
      where: { productId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}