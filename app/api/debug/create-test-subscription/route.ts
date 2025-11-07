import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, productId, daysToExpiry = 7 } = body

    if (!userId || !productId) {
      return NextResponse.json(
        { error: 'userId and productId are required' },
        { status: 400 }
      )
    }

    // Получаем информацию о продукте
    const product = await prisma.product.findUnique({
      where: { productId }
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Создаем тестовую подписку
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + daysToExpiry)

    const subscription = await prisma.subscription.create({
      data: {
        userId: BigInt(userId),
        productId,
        channelId: BigInt(product.channelId),
        status: 'active',
        expiresAt
      }
    })

    // Получаем полную информацию о подписке
    const fullSubscription = await prisma.subscription.findUnique({
      where: { subscriptionId: subscription.subscriptionId },
      include: {
        user: true,
        product: {
          include: {
            channel: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        subscription: fullSubscription ? {
          ...fullSubscription,
          userId: fullSubscription.userId.toString(),
          price: fullSubscription.price.toString()
        } : null,
        expiresAt: expiresAt.toISOString(),
        daysToExpiry
      }
    })

  } catch (error) {
    console.error('Error creating test subscription:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Test subscription endpoint is working',
    usage: {
      method: 'POST',
      body: {
        userId: 'number (Telegram user ID)',
        productId: 'string (Product ID)',
        daysToExpiry: 'number (optional, default: 7)'
      }
    }
  })
}