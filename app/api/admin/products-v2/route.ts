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
      console.log('🔍 ADMIN AUTH: No init data found')
      return false
    }

    console.log('🔍 ADMIN AUTH: Checking auth with init data length:', initData.length)

    // Проверяем на тестовые данные администратора
    if (initData.includes('admin_test_hash_for_')) {
      console.log('🔍 ADMIN AUTH: Using test admin data')
      const urlParams = new URLSearchParams(initData)
      const userStr = urlParams.get('user')
      if (!userStr) return false

      const user = JSON.parse(decodeURIComponent(userStr))
      const telegramId = BigInt(user.id)
      const adminTelegramId = process.env.ADMIN_TELEGRAM_ID

      if (!adminTelegramId) {
        console.log('🔍 ADMIN AUTH: ADMIN_TELEGRAM_ID not configured')
        return false
      }

      return telegramId.toString() === adminTelegramId
    }

    // Для реальных данных используем валидацию
    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      console.log('🔍 ADMIN AUTH: Failed Telegram validation')
      return false
    }

    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')
    if (!userStr) return false

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    // Проверяем, является ли пользователь администратором или создает админа
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID
    if (!adminTelegramId) {
      console.log('🔍 ADMIN AUTH: ADMIN_TELEGRAM_ID not configured')
      return false
    }

    if (telegramId.toString() === adminTelegramId) {
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

        await prisma.admin.upsert({
          where: { telegramId },
          update: {},
          create: { telegramId }
        })
        console.log('🔍 ADMIN AUTH: Admin record created/updated successfully')
        return true
      } catch (createError) {
        console.error('🔍 ADMIN AUTH: Failed to create admin record:', createError)
        return false
      }
    }

    console.log('🔍 ADMIN AUTH: User is not admin, ID:', telegramId.toString())
    return false
  } catch (error) {
    console.error('🔍 ADMIN AUTH: Error parsing user data:', error)
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
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

    // Конвертируем BigInt в string
    const serializedProducts = products.map(product => ({
      id: product.productId,
      name: product.name,
      description: product.description,
      price: product.price,
      periodDays: product.periodDays,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      discountPrice: product.discountPrice,
      isTrial: product.isTrial,
      channel: {
        id: product.channel.channelId.toString(),
        name: product.channel.name,
        username: product.channel.username,
        description: product.channel.description,
        createdAt: product.channel.createdAt
      },
      _count: {
        subscriptions: product._count.subscriptions
      }
    }))

    return createJsonResponse({ products: serializedProducts })

  } catch (error) {
    console.error('Error fetching products:', error)
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
    const { name, description, price, channelTelegramId, periodDays, isActive } = body

    if (!name || !price || !channelTelegramId) {
      return createJsonResponse(
        { error: 'Missing required fields' },
        400
      )
    }

    console.log('🔍 API: Creating product with data:', {
      name,
      description: description || '',
      price: parseFloat(price),
      channelTelegramId,
      periodDays: periodDays || '30',
      isActive: isActive !== false
    })

    // Clean and process channel ID
    let cleanChannelId = channelTelegramId.startsWith('@')
      ? channelTelegramId.slice(1)
      : channelTelegramId

    // Convert to proper BigInt format
    let finalChannelId = cleanChannelId
    if (!/^\d+$/.test(cleanChannelId)) {
      // If it's a username or non-numeric, convert to a unique negative number
      finalChannelId = `-${Math.abs(cleanChannelId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0))}`
    }

    let channel = null
    try {
      channel = await prisma.channel.findUnique({
        where: { channelId: BigInt(finalChannelId) }
      })
    } catch (error) {
      console.log('🔍 API: Error finding channel, trying as string:', error)
    }

    if (!channel) {
      console.log('🔍 API: Channel not found, creating new channel...')
      channel = await prisma.channel.create({
        data: {
          channelId: BigInt(finalChannelId),
          name: `Channel ${channelTelegramId}`,
          username: channelTelegramId.startsWith('@') ? channelTelegramId : `@${channelTelegramId}`
        }
      })
      console.log('🔍 API: Channel created successfully:', channel.channelId.toString())
    } else {
      console.log('🔍 API: Found existing channel:', channel.channelId.toString())
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description || '',
        price: parseFloat(price),
        channelId: channel.channelId,
        periodDays: parseInt(periodDays) || 30,
        isActive: isActive !== false
      },
      include: {
        channel: true
      }
    })

    console.log('🔍 API: Product created successfully:', product.productId)

    // Конвертируем BigInt в string
    const serializedProduct = {
      id: product.productId,
      name: product.name,
      description: product.description,
      price: product.price,
      periodDays: product.periodDays,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      discountPrice: product.discountPrice,
      isTrial: product.isTrial,
      channel: {
        id: product.channel.channelId.toString(),
        name: product.channel.name,
        username: product.channel.username,
        description: product.channel.description,
        createdAt: product.channel.createdAt
      }
    }

    return createJsonResponse({ product: serializedProduct })

  } catch (error) {
    console.error('🔥 PRODUCT ERROR: Error creating product:', error)
    console.error('🔥 PRODUCT ERROR: Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('id')

    if (!productId) {
      return createJsonResponse(
        { error: 'Product ID is required' },
        400
      )
    }

    const { name, description, price, channelTelegramId, periodDays, isActive } = await request.json()

    let updateData: any = {}

    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (price !== undefined) updateData.price = parseFloat(price)
    if (periodDays !== undefined) updateData.periodDays = parseInt(periodDays)
    if (isActive !== undefined) updateData.isActive = isActive

    if (channelTelegramId) {
      // Clean and process channel ID
      let cleanChannelId = channelTelegramId.startsWith('@')
        ? channelTelegramId.slice(1)
        : channelTelegramId

      // Convert to proper BigInt format
      let finalChannelId = cleanChannelId
      if (!/^\d+$/.test(cleanChannelId)) {
        // If it's a username or non-numeric, convert to a unique negative number
        finalChannelId = `-${Math.abs(cleanChannelId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0))}`
      }

      let channel = null
      try {
        channel = await prisma.channel.findUnique({
          where: { channelId: BigInt(finalChannelId) }
        })
      } catch (error) {
        console.log('🔍 API: Error finding channel for update, creating new')
      }

      if (!channel) {
        channel = await prisma.channel.create({
          data: {
            channelId: BigInt(finalChannelId),
            name: `Channel ${channelTelegramId}`,
            username: channelTelegramId.startsWith('@') ? channelTelegramId : `@${channelTelegramId}`
          }
        })
      }

      updateData.channelId = channel.channelId
    }

    const product = await prisma.product.update({
      where: { productId: productId },
      data: updateData,
      include: {
        channel: true
      }
    })

    const serializedProduct = {
      id: product.productId,
      name: product.name,
      description: product.description,
      price: product.price,
      periodDays: product.periodDays,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      discountPrice: product.discountPrice,
      isTrial: product.isTrial,
      channel: {
        id: product.channel.channelId.toString(),
        name: product.channel.name,
        username: product.channel.username,
        description: product.channel.description,
        createdAt: product.channel.createdAt
      }
    }

    return createJsonResponse({ product: serializedProduct })

  } catch (error) {
    console.error('Error updating product:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('id')

    if (!productId) {
      return createJsonResponse(
        { error: 'Product ID is required' },
        400
      )
    }

    const activeSubscriptions = await prisma.subscription.count({
      where: {
        productId: productId,
        status: 'active'
      }
    })

    if (activeSubscriptions > 0) {
      return createJsonResponse(
        { error: 'Cannot delete product with active subscriptions' },
        400
      )
    }

    await prisma.product.delete({
      where: { productId: productId }
    })

    return createJsonResponse({ success: true })

  } catch (error) {
    console.error('Error deleting product:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}