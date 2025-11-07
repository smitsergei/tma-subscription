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

// GET - Получение всех демо-доступов
export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const demoAccesses = await prisma.demoAccess.findMany({
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            username: true
          }
        },
        product: {
          select: {
            productId: true,
            name: true,
            price: true
          }
        }
      },
      orderBy: {
        startedAt: 'desc'
      }
    })

    // Конвертируем BigInt в string и добавляем статус
    const serializedDemoAccesses = demoAccesses.map(demo => {
      const now = new Date()
      const isExpired = demo.expiresAt < now
      const daysLeft = Math.ceil((demo.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      return {
        id: demo.id,
        userId: demo.userId.toString(),
        productId: demo.productId,
        startedAt: demo.startedAt.toISOString(),
        expiresAt: demo.expiresAt.toISOString(),
        isActive: demo.isActive && !isExpired,
        isExpired,
        daysLeft: Math.max(0, daysLeft),
        user: {
          ...demo.user,
          telegramId: demo.user.telegramId.toString()
        },
        product: demo.product
      }
    })

    // Получаем статистику
    const totalDemoAccesses = await prisma.demoAccess.count()
    const activeDemoAccesses = await prisma.demoAccess.count({
      where: {
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    })

    return createJsonResponse({
      demoAccesses: serializedDemoAccesses,
      stats: {
        total: totalDemoAccesses,
        active: activeDemoAccesses,
        expired: totalDemoAccesses - activeDemoAccesses
      }
    })

  } catch (error) {
    console.error('Error fetching demo accesses:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}