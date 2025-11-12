import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

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

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  console.log('🔍 AUTH: Starting admin authentication check')

  const initData = request.headers.get('x-telegram-init-data')
  console.log('🔍 AUTH: Init data present:', !!initData)

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
    console.log('🔍 AUTH: No user data in init data')
    return false
  }

  try {
    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)
    console.log('🔍 AUTH: Extracted telegram ID:', telegramId.toString())

    console.log('🔍 AUTH: Checking admin in database...')
    const admin = await prisma.admin.findUnique({
      where: { telegramId }
    })

    console.log('🔍 AUTH: Admin found:', !!admin)

    if (!admin) {
      console.log('🔍 AUTH: User is not an admin. Creating admin record...')
      try {
        // Попробуем создать администратора автоматически для тестирования
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

    return true
  } catch (error) {
    console.error('🔍 AUTH: Error parsing user data:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return createJsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { productOrders } = await request.json()

    console.log('🔍 REORDER: Updating product orders:', productOrders)

    if (!Array.isArray(productOrders)) {
      return createJsonResponse(
        { error: 'productOrders must be an array' },
        400
      )
    }

    // Валидация данных
    for (const item of productOrders) {
      if (!item.productId || typeof item.productId !== 'string') {
        return createJsonResponse(
          { error: 'Each item must have a valid productId string' },
          400
        )
      }
      if (item.sortOrder !== undefined && (typeof item.sortOrder !== 'number' || item.sortOrder < 0)) {
        return createJsonResponse(
          { error: 'sortOrder must be a non-negative number or null' },
          400
        )
      }
    }

    // Обновляем порядок продуктов в базе данных
    const updatePromises = productOrders.map(async ({ productId, sortOrder }) => {
      return prisma.product.update({
        where: { productId },
        data: { sortOrder: sortOrder !== undefined ? sortOrder : null }
      })
    })

    await Promise.all(updatePromises)

    console.log('✅ REORDER: Successfully updated product orders')

    // Очищаем кеш связанных страниц
    revalidatePath('/api/products')
    revalidatePath('/app')
    revalidatePath('/admin')

    return createJsonResponse({ success: true })

  } catch (error) {
    console.error('🔥 REORDER ERROR: Error updating product orders:', error)
    console.error('🔥 REORDER ERROR: Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorId: Date.now().toString()
      },
      500
    )
  }
}