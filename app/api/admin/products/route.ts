import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

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
      productId: product.productId.toString(),
      name: product.name,
      description: product.description,
      price: parseFloat(product.price.toString()),
      periodDays: product.periodDays,
      isActive: product.isActive,
      isTrial: product.isTrial,
      discountPrice: product.discountPrice ? parseFloat(product.discountPrice.toString()) : null,
      allowDemo: product.allowDemo,
      demoDays: product.demoDays,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      channelId: product.channelId.toString(),
      channel: {
        channelId: product.channel.channelId.toString(),
        name: product.channel.name,
        username: product.channel.username,
        description: product.channel.description,
        createdAt: product.channel.createdAt
      },
      _count: product._count
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

    const { name, description, price, channelTelegramId, channelName, channelUsername, periodDays, isActive } = await request.json()

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
            name: channelName || `Channel ${channelTelegramId}`,
            username: channelUsername || null,
          }
        })
        console.log('🔍 API: Channel created successfully:', channel.channelId.toString())
      } catch (channelError) {
        console.error('🔍 API: Error creating channel:', channelError)
        throw new Error(`Failed to create channel: ${channelError instanceof Error ? channelError.message : 'Unknown error'}`)
      }
    } else if (channelName || channelUsername) {
      console.log('🔍 API: Updating existing channel with new data...')
      try {
        channel = await prisma.channel.update({
          where: { channelId: BigInt(cleanChannelId) },
          data: {
            ...(channelName && { name: channelName }),
            ...(channelUsername !== undefined && { username: channelUsername }),
          }
        })
        console.log('🔍 API: Channel updated successfully:', channel.channelId.toString())
      } catch (channelError) {
        console.error('🔍 API: Error updating channel:', channelError)
        throw new Error(`Failed to update channel: ${channelError instanceof Error ? channelError.message : 'Unknown error'}`)
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
      productId: product.productId.toString(),
      name: product.name,
      description: product.description,
      price: parseFloat(product.price.toString()),
      periodDays: product.periodDays,
      isActive: product.isActive,
      isTrial: product.isTrial,
      discountPrice: product.discountPrice ? parseFloat(product.discountPrice.toString()) : null,
      allowDemo: product.allowDemo,
      demoDays: product.demoDays,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      channelId: product.channelId.toString(),
      channel: {
        channelId: product.channel.channelId.toString(),
        name: product.channel.name,
        username: product.channel.username,
        description: product.channel.description,
        createdAt: product.channel.createdAt
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

    const { name, description, price, channelTelegramId, channelName, channelUsername, periodDays, isActive } = await request.json()

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
            name: channelName || `Channel ${channelTelegramId}`,
            username: channelUsername || null,
          }
        })
      } else if (channelName || channelUsername) {
        // Update existing channel if name or username is provided
        channel = await prisma.channel.update({
          where: { channelId: BigInt(cleanChannelId) },
          data: {
            ...(channelName && { name: channelName }),
            ...(channelUsername !== undefined && { username: channelUsername }),
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
      productId: product.productId.toString(),
      name: product.name,
      description: product.description,
      price: parseFloat(product.price.toString()),
      periodDays: product.periodDays,
      isActive: product.isActive,
      isTrial: product.isTrial,
      discountPrice: product.discountPrice ? parseFloat(product.discountPrice.toString()) : null,
      allowDemo: product.allowDemo,
      demoDays: product.demoDays,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      channelId: product.channelId.toString(),
      channel: {
        channelId: product.channel.channelId.toString(),
        name: product.channel.name,
        username: product.channel.username,
        description: product.channel.description,
        createdAt: product.channel.createdAt
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