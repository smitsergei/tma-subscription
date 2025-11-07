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
      console.log('🔍 AUTH: No init data found')
      return false
    }

    console.log('🔍 AUTH: Validating init data...')
    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      console.log('🔍 AUTH: Init data validation failed')
      return false
    }
    console.log('🔍 AUTH: Init data validation passed')

    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')
    console.log('🔍 AUTH: User string present:', !!userStr)

    if (!userStr) {
      console.log('🔍 AUTH: No user string found')
      return false
    }

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    const admin = await prisma.admin.findUnique({
      where: { telegramId }
    })

    if (!admin) {
      console.log('🔍 AUTH: Admin not found, creating...')

      // Создаем админа если его нет
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

        console.log('🔍 AUTH: Admin record created successfully')
        return true
      } catch (createError) {
        console.error('🔍 AUTH: Failed to create admin record:', createError)
        return false
      }
    }

    console.log('🔍 AUTH: Admin found: true')
    return true
  } catch (error) {
    console.error('🔍 AUTH: Error parsing user data:', error)
    return false
  }
}

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
            id: true,
            name: true,
            price: true,
            demoDays: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Конвертируем BigInt в string
    const serializedDemoAccesses = demoAccesses.map(demoAccess => ({
      id: demoAccess.id,
      userId: demoAccess.userId.toString(),
      productId: demoAccess.productId,
      startedAt: demoAccess.startedAt.toISOString(),
      expiresAt: demoAccess.expiresAt.toISOString(),
      isActive: demoAccess.isActive,
      user: {
        telegramId: demoAccess.user.telegramId.toString(),
        firstName: demoAccess.user.firstName,
        username: demoAccess.user.username
      },
      product: demoAccess.product
    }))

    return createJsonResponse({ demoAccesses: serializedDemoAccesses })

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