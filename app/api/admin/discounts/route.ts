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

    const discounts = await prisma.discount.findMany({
      include: {
        product: {
          select: {
            productId: true,
            name: true,
            price: true
          }
        },
        _count: {
          select: {
            usageHistory: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Конвертируем BigInt в string
    const serializedDiscounts = discounts.map(discount => ({
      id: discount.id,
      productId: discount.productId,
      type: discount.type,
      value: parseFloat(discount.value.toString()),
      isActive: discount.isActive,
      startDate: discount.startDate.toISOString(),
      endDate: discount.endDate.toISOString(),
      createdAt: discount.createdAt.toISOString(),
      updatedAt: discount.updatedAt.toISOString(),
      product: discount.product,
      _count: discount._count
    }))

    return createJsonResponse({ discounts: serializedDiscounts })

  } catch (error) {
    console.error('Error fetching discounts:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { productId, type, value, isActive, startDate, endDate } = body

    if (!productId || !type || value === undefined || !startDate || !endDate) {
      return createJsonResponse(
        { error: 'Missing required fields' },
        400
      )
    }

    console.log('🔍 Creating discount with data:', {
      productId,
      type,
      value: parseFloat(value),
      isActive: isActive !== false,
      startDate,
      endDate
    })

    // Проверяем, что существует продукт
    const product = await prisma.product.findUnique({
      where: { productId }
    })

    if (!product) {
      return createJsonResponse(
        { error: 'Product not found' },
        404
      )
    }

    const discount = await prisma.discount.create({
      data: {
        productId,
        type,
        value: parseFloat(value),
        isActive: isActive !== false,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      },
      include: {
        product: {
          select: {
            productId: true,
            name: true,
            price: true
          }
        }
      }
    })

    console.log('🔍 Discount created successfully:', discount.id)

    // Конвертируем BigInt в string
    const serializedDiscount = {
      id: discount.id,
      productId: discount.productId,
      type: discount.type,
      value: parseFloat(discount.value.toString()),
      isActive: discount.isActive,
      startDate: discount.startDate.toISOString(),
      endDate: discount.endDate.toISOString(),
      createdAt: discount.createdAt.toISOString(),
      updatedAt: discount.updatedAt.toISOString(),
      product: discount.product
    }

    return createJsonResponse({ discount: serializedDiscount })

  } catch (error) {
    console.error('Error creating discount:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}