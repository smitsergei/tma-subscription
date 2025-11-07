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

    console.log(`Created test subscription: ${subscription.subscriptionId} for user ${userId}`)

    return NextResponse.json({
      success: true,
      message: `Test subscription created successfully`,
      data: {
        subscriptionId: subscription.subscriptionId,
        userId: userId.toString(),
        productId: productId,
        expiresAt: expiresAt.toISOString(),
        daysToExpiry,
        productName: product.name
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

export async function GET(request: NextRequest) {
  try {
    // Показываем все активные подписки
    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'active' },
      include: {
        user: true,
        product: true
      },
      orderBy: { expiresAt: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: subscriptions.map(sub => ({
        ...sub,
        userId: sub.userId.toString(),
        expiresAt: sub.expiresAt.toISOString(),
        daysRemaining: Math.ceil((sub.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }))
    })

  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}