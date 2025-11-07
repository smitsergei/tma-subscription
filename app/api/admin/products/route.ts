import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Конвертируем BigInt в string для JSON сериализации
    const serializedProducts = products.map(product => ({
      ...product,
      productId: product.productId.toString(),
      channel: {
        ...product.channel,
        channelId: product.channel.channelId.toString()
      }
    }))

    return NextResponse.json({ products: serializedProducts })

  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, description, price, channelTelegramId, periodDays, isActive } = await request.json()

    console.log('🔍 API: Creating product with data:', {
      name: !!name,
      description: !!description,
      price: price,
      channelTelegramId: channelTelegramId,
      periodDays: periodDays,
      isActive: isActive
    })

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Product name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      return NextResponse.json(
        { error: 'Product price is required and must be a positive number' },
        { status: 400 }
      )
    }

    if (!channelTelegramId || typeof channelTelegramId !== 'string' || channelTelegramId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Channel Telegram ID is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Clean channel ID (remove @ if present)
    const cleanChannelId = channelTelegramId.startsWith('@')
      ? channelTelegramId.slice(1)
      : channelTelegramId

    console.log('🔍 API: Cleaned channel ID:', cleanChannelId)

    // Find or create channel
    console.log('🔍 API: Looking for channel with ID:', cleanChannelId)
    let channel = await prisma.channel.findUnique({
      where: { channelId: BigInt(cleanChannelId) }
    })

    if (!channel) {
      console.log('🔍 API: Channel not found, creating new channel...')
      try {
        channel = await prisma.channel.create({
          data: {
            channelId: BigInt(cleanChannelId),
            name: `Channel ${channelTelegramId}`,
          }
        })
        console.log('🔍 API: Channel created successfully:', channel.channelId.toString())
      } catch (channelError) {
        console.error('🔍 API: Error creating channel:', channelError)
        throw new Error(`Failed to create channel: ${channelError instanceof Error ? channelError.message : 'Unknown error'}`)
      }
    } else {
      console.log('🔍 API: Found existing channel:', channel.channelId.toString())
    }

    console.log('🔍 API: Creating product with data:', {
      name,
      description: description || '',
      price: parseFloat(price),
      channelId: channel.channelId,
      periodDays: periodDays || 30,
      isActive: isActive !== false
    })

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

    // Конвертируем BigInt в string для JSON сериализации
    const serializedProduct = {
      ...product,
      productId: product.productId.toString(),
      channel: {
        ...product.channel,
        channelId: product.channel.channelId.toString()
      }
    }

    return NextResponse.json({ product: serializedProduct })

  } catch (error) {
    console.error('🔥 PRODUCT ERROR: Error creating product:', error)
    console.error('🔥 PRODUCT ERROR: Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      // @ts-ignore - cause might not exist in older TypeScript versions
      cause: error instanceof Error ? (error as any).cause : undefined
    })

    // Отправляем ошибку в наш error catcher
    try {
      await fetch('https://tma-subscription.vercel.app/api/catch-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack : 'Unknown',
          source: 'api/admin/products POST',
          timestamp: new Date().toISOString(),
          user: 'product_creation'
        })
      })
    } catch (logError) {
      console.error('🔥 PRODUCT ERROR: Failed to send error to logger:', logError)
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorId: Date.now().toString()
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('id')

    if (!productId) {
      return NextResponse.json(
        { error: 'product id is required' },
        { status: 400 }
      )
    }

    const { name, description, price, channelTelegramId, periodDays, isActive } = await request.json()

    // Handle channel change if provided
    let updateData: any = {}

    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (price !== undefined) updateData.price = parseFloat(price)
    if (periodDays !== undefined) updateData.periodDays = parseInt(periodDays)
    if (isActive !== undefined) updateData.isActive = isActive

    if (channelTelegramId) {
      // Clean channel ID (remove @ if present)
      const cleanChannelId = channelTelegramId.startsWith('@')
        ? channelTelegramId.slice(1)
        : channelTelegramId

      let channel = await prisma.channel.findUnique({
        where: { channelId: BigInt(cleanChannelId) }
      })

      if (!channel) {
        channel = await prisma.channel.create({
          data: {
            channelId: BigInt(cleanChannelId),
            name: `Channel ${channelTelegramId}`,
          }
        })
      }

      updateData.channelId = channel.channelId
    }

    const product = await prisma.product.update({
      where: { productId },
      data: updateData,
      include: {
        channel: true
      }
    })

    // Конвертируем BigInt в string для JSON сериализации
    const serializedProduct = {
      ...product,
      productId: product.productId.toString(),
      channel: {
        ...product.channel,
        channelId: product.channel.channelId.toString()
      }
    }

    return NextResponse.json({ product: serializedProduct })

  } catch (error) {
    console.error('Error updating product:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('id')

    if (!productId) {
      return NextResponse.json(
        { error: 'product id is required' },
        { status: 400 }
      )
    }

    // Check if product has active subscriptions
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        productId,
        status: 'active'
      }
    })

    if (activeSubscriptions > 0) {
      return NextResponse.json(
        { error: 'Cannot delete product with active subscriptions' },
        { status: 400 }
      )
    }

    await prisma.product.delete({
      where: { productId }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}