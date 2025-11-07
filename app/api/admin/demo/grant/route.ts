import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

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

// Функция для проверки админ прав
async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  try {
    const initData = request.headers.get('x-telegram-init-data');

    if (!initData) {
      return false
    }

    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return false
    }

    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')

    if (!userStr) {
      return false
    }

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    const admin = await prisma.admin.findUnique({
      where: { telegramId }
    })

    return !!admin
  } catch (error) {
    console.error('Auth error:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { userId, productId, demoDays } = body

    if (!userId || !productId || !demoDays) {
      return createJsonResponse(
        { error: 'Missing required fields' },
        400
      )
    }

    console.log('🔍 Granting demo access with data:', {
      userId,
      productId,
      demoDays
    })

    // Проверяем, что существует пользователь
    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) }
    })

    if (!user) {
      // Создаем пользователя если его нет
      user = await prisma.user.create({
        data: {
          telegramId: BigInt(userId),
          firstName: 'Demo User',
        }
      })
    }

    // Проверяем, что продукт существует и поддерживает демо
    const product = await prisma.product.findUnique({
      where: { productId }
    })

    if (!product) {
      return createJsonResponse(
        { error: 'Product not found' },
        404
      )
    }

    if (!product.allowDemo) {
      return createJsonResponse(
        { error: 'Product does not support demo access' },
        400
      )
    }

    // Проверяем, есть ли уже активный демо-доступ
    const existingDemoAccess = await prisma.demoAccess.findFirst({
      where: {
        userId: BigInt(userId),
        productId: productId,
        isActive: true
      }
    })

    if (existingDemoAccess) {
      return createJsonResponse(
        { error: 'User already has an active demo access for this product' },
        400
      )
    }

    // Создаем демо-доступ
    const now = new Date()
    const expiresAt = new Date(now.getTime() + demoDays * 24 * 60 * 60 * 1000)

    const demoAccess = await prisma.demoAccess.create({
      data: {
        userId: BigInt(userId),
        productId,
        startedAt: now,
        expiresAt,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            username: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            price: true
          }
        }
      }
    })

    console.log('🔍 Demo access granted successfully:', demoAccess.id)

    // Конвертируем BigInt в string
    const serializedDemoAccess = {
      id: demoAccess.id,
      userId: demoAccess.userId.toString(),
      productId: demoAccess.productId,
      startedAt: demoAccess.startedAt.toISOString(),
      expiresAt: demoAccess.expiresAt.toISOString(),
      isActive: demoAccess.isActive,
      user: demoAccess.user,
      product: demoAccess.product
    }

    return createJsonResponse({ demoAccess: serializedDemoAccess })

  } catch (error) {
    console.error('Error granting demo access:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}