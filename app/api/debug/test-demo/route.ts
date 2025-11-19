import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Показываем все демо-доступы
    const demoAccesses = await prisma.demoAccess.findMany({
      include: {
        user: true,
        product: true
      },
      orderBy: { startedAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: demoAccesses.map(demo => ({
        id: demo.id,
        userId: demo.userId.toString(),
        productId: demo.productId,
        startedAt: demo.startedAt.toISOString(),
        expiresAt: demo.expiresAt.toISOString(),
        isActive: demo.isActive,
        reminderSent: demo.reminderSent,
        daysRemaining: Math.ceil((demo.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
        user: demo.user ? {
          telegramId: demo.user.telegramId.toString(),
          firstName: demo.user.firstName,
          username: demo.user.username
        } : null,
        product: demo.product ? {
          productId: demo.product.productId,
          name: demo.product.name,
          description: demo.product.description,
          demoDays: demo.product.demoDays
        } : null
      }))
    })

  } catch (error) {
    console.error('Error fetching demo accesses:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, productId, demoDays = 7 } = body

    if (!userId || !productId) {
      return NextResponse.json(
        { error: 'userId and productId are required' },
        { status: 400 }
      )
    }

    // Проверяем, не существует ли уже демо-доступ
    const existingDemo = await prisma.demoAccess.findFirst({
      where: {
        userId: BigInt(userId),
        productId,
        isActive: true
      }
    })

    if (existingDemo) {
      return NextResponse.json(
        { error: 'Demo access already exists for this user and product' },
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

    // Создаем тестовый демо-доступ
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + demoDays)

    const demoAccess = await prisma.demoAccess.create({
      data: {
        userId: BigInt(userId),
        productId,
        startedAt: new Date(),
        expiresAt,
        isActive: true,
        reminderSent: false
      }
    })

    console.log(`Created test demo access: ${demoAccess.id} for user ${userId}`)

    return NextResponse.json({
      success: true,
      message: `Test demo access created successfully`,
      data: {
        id: demoAccess.id,
        userId: userId.toString(),
        productId: productId,
        expiresAt: expiresAt.toISOString(),
        daysRemaining: demoDays,
        productName: product.name
      }
    })

  } catch (error) {
    console.error('Error creating test demo access:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    )
  }
}