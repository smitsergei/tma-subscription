import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export const dynamic = 'force-dynamic'

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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const demoId = params.id
    const body = await request.json()
    const { newExpiresAt } = body

    if (!newExpiresAt) {
      return createJsonResponse(
        { error: 'New expiration date is required' },
        400
      )
    }

    // Парсим дату и проверяем валидность
    let expiresDate: Date
    try {
      expiresDate = new Date(newExpiresAt)
      if (isNaN(expiresDate.getTime())) {
        throw new Error('Invalid date format')
      }
    } catch (error) {
      return createJsonResponse(
        { error: 'Invalid date format', details: 'Please provide a valid date string' },
        400
      )
    }

    // Проверяем, что новая дата в будущем
    const now = new Date()
    if (expiresDate <= now) {
      return createJsonResponse(
        { error: 'New expiration date must be in the future' },
        400
      )
    }

    console.log('🔍 Extending demo access:', demoId, 'to', expiresDate.toISOString())

    // Проверяем существование демо-доступа
    const existingDemoAccess = await prisma.demoAccess.findUnique({
      where: { id: demoId }
    })

    if (!existingDemoAccess) {
      return createJsonResponse(
        { error: 'Demo access not found' },
        404
      )
    }

    const updatedDemoAccess = await prisma.demoAccess.update({
      where: { id: demoId },
      data: {
        expiresAt: expiresDate,
        isActive: true // Активируем, если был неактивен
      },
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
      }
    })

    console.log('🔍 Demo access extended successfully:', updatedDemoAccess.id)

    // Конвертируем BigInt в string
    const serializedDemoAccess = {
      id: updatedDemoAccess.id,
      userId: updatedDemoAccess.userId.toString(),
      productId: updatedDemoAccess.productId,
      startedAt: updatedDemoAccess.startedAt.toISOString(),
      expiresAt: updatedDemoAccess.expiresAt.toISOString(),
      isActive: updatedDemoAccess.isActive,
      user: updatedDemoAccess.user,
      product: updatedDemoAccess.product
    }

    return createJsonResponse({ demoAccess: serializedDemoAccess })

  } catch (error) {
    console.error('Error extending demo access:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}