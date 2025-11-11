import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export const dynamic = 'force-dynamic'

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

    const { name, description, price, channelTelegramId, channelName, channelUsername, periodDays, isActive, allowDemo, demoDays } = await request.json()

    console.log('🔍 API: Creating product with data:', {
      name: !!name,
      description: !!description,
      price: price,
      channelTelegramId: channelTelegramId,
      periodDays: periodDays,
      isActive: isActive,
      allowDemo: allowDemo,
      demoDays: demoDays
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
        // Проверяем, не пытаемся ли мы установить username, который уже занят
        if (channelUsername !== undefined && channelUsername !== channel.username) {
          const existingChannelWithSameUsername = await prisma.channel.findUnique({
            where: { username: channelUsername }
          })

          if (existingChannelWithSameUsername && existingChannelWithSameUsername.channelId !== channel.channelId) {
            console.log('⚠️ API: Username', channelUsername, 'already used by another channel')
            throw new Error(`Username '${channelUsername}' is already used by another channel`)
          }
        }

        const updateData: any = {}
        if (channelName) updateData.name = channelName
        if (channelUsername !== undefined) updateData.username = channelUsername

        channel = await prisma.channel.update({
          where: { channelId: BigInt(cleanChannelId) },
          data: updateData
        })
        console.log('🔍 API: Channel updated successfully:', channel.channelId.toString())
      } catch (channelError) {
        console.error('🔍 API: Error updating channel:', channelError)

        // Обрабатываем специфически ошибку дубликата username
        if (channelError instanceof Error && channelError.message.includes('Unique constraint failed')) {
          throw new Error(`Username '${channelUsername}' is already taken by another channel`)
        }

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
      isActive: isActive !== false,
      allowDemo: allowDemo || false,
      demoDays: allowDemo && demoDays ? parseInt(demoDays) : 7
    })

    const product = await prisma.product.create({
      data: {
        name,
        description: description || '',
        price: parseFloat(price),
        channelId: channel.channelId,
        periodDays: parseInt(periodDays) || 30,
        isActive: isActive !== false,
        allowDemo: allowDemo || false,
        demoDays: allowDemo && demoDays ? parseInt(demoDays) : 7
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
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('id')

  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!productId) {
      return NextResponse.json(
        { error: 'product id is required' },
        { status: 400 }
      )
    }

    const { name, description, price, channelTelegramId, channelName, channelUsername, periodDays, isActive, allowDemo, demoDays } = await request.json()

    // Handle channel change if provided
    let updateData: any = {}

    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (price !== undefined) updateData.price = parseFloat(price)
    if (periodDays !== undefined) updateData.periodDays = parseInt(periodDays)
    if (isActive !== undefined) updateData.isActive = isActive
    if (allowDemo !== undefined) updateData.allowDemo = allowDemo
    if (allowDemo && demoDays !== undefined) updateData.demoDays = parseInt(demoDays) || 7

    if (channelTelegramId || channelName || channelUsername) {
      // Get current product to find its channel ID
      const currentProduct = await prisma.product.findUnique({
        where: { productId },
        select: { channelId: true }
      })

      let targetChannelId: bigint

      if (channelTelegramId) {
        // Clean channel ID (remove @ if present)
        const cleanChannelId = channelTelegramId.startsWith('@')
          ? channelTelegramId.slice(1)
          : channelTelegramId
        targetChannelId = BigInt(cleanChannelId)
      } else if (currentProduct?.channelId) {
        // Use existing channel ID if no new ID provided
        targetChannelId = currentProduct.channelId
      } else {
        throw new Error('Channel ID is required but not found')
      }

      let channel = await prisma.channel.findUnique({
        where: { channelId: targetChannelId }
      })

      if (!channel) {
        channel = await prisma.channel.create({
          data: {
            channelId: targetChannelId,
            name: channelName || `Channel ${channelTelegramId || targetChannelId}`,
            username: channelUsername || null,
          }
        })
      } else if (channelName || channelUsername) {
        // Update existing channel if name or username is provided
        try {
          // Проверяем, не пытаемся ли мы установить username, который уже занят
          if (channelUsername !== undefined && channelUsername !== channel.username) {
            const existingChannelWithSameUsername = await prisma.channel.findUnique({
              where: { username: channelUsername }
            })

            if (existingChannelWithSameUsername && existingChannelWithSameUsername.channelId !== channel.channelId) {
              console.log('⚠️ API: Username', channelUsername, 'already used by another channel')
              throw new Error(`Username '${channelUsername}' is already used by another channel`)
            }
          }

          const updateData: any = {}
          if (channelName) updateData.name = channelName
          if (channelUsername !== undefined) updateData.username = channelUsername

          channel = await prisma.channel.update({
            where: { channelId: targetChannelId },
            data: updateData
          })
        } catch (channelError) {
          console.error('🔍 API: Error updating channel:', channelError)

          // Обрабатываем специфически ошибку дубликата username
          if (channelError instanceof Error && channelError.message.includes('Unique constraint failed')) {
            throw new Error(`Username '${channelUsername}' is already taken by another channel`)
          }

          throw new Error(`Failed to update channel: ${channelError instanceof Error ? channelError.message : 'Unknown error'}`)
        }
      }

      // Only update channelId if it actually changed
      if (channelTelegramId && (!currentProduct?.channelId || currentProduct.channelId !== channel.channelId)) {
        updateData.channelId = channel.channelId
      }
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
  // Извлекаем productId в начале функции, чтобы он был доступен в блоке catch
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('id')

  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Check if product has related discounts and delete them first
    console.log(`🗑️ DELETION: Checking for discounts related to product ${productId}`)

    const relatedDiscounts = await prisma.discount.findMany({
      where: { productId }
    })

    if (relatedDiscounts.length > 0) {
      console.log(`🗑️ DELETION: Found ${relatedDiscounts.length} discounts for product ${productId}, deleting them first`)

      // Delete discount usage records first
      await prisma.discountUsage.deleteMany({
        where: {
          discountId: {
            in: relatedDiscounts.map(d => d.id)
          }
        }
      })

      // Delete the discounts
      await prisma.discount.deleteMany({
        where: { productId }
      })

      console.log(`🗑️ DELETION: Successfully deleted all discounts for product ${productId}`)
    }

    // Check if product has related promo codes and delete them first
    console.log(`🗑️ DELETION: Checking for promo codes related to product ${productId}`)

    const relatedPromoCodes = await prisma.promoCode.findMany({
      where: { productId }
    })

    if (relatedPromoCodes.length > 0) {
      console.log(`🗑️ DELETION: Found ${relatedPromoCodes.length} promo codes for product ${productId}, deleting them first`)

      // Delete promo usage records first
      await prisma.promoUsage.deleteMany({
        where: {
          promoId: {
            in: relatedPromoCodes.map(p => p.id)
          }
        }
      })

      // Delete the promo codes
      await prisma.promoCode.deleteMany({
        where: { productId }
      })

      console.log(`🗑️ DELETION: Successfully deleted all promo codes for product ${productId}`)
    }

    // Check if product has related demo access records and delete them first
    console.log(`🗑️ DELETION: Checking for demo access records related to product ${productId}`)

    const relatedDemoAccess = await prisma.demoAccess.findMany({
      where: { productId }
    })

    if (relatedDemoAccess.length > 0) {
      console.log(`🗑️ DELETION: Found ${relatedDemoAccess.length} demo access records for product ${productId}, deleting them first`)

      // Delete the demo access records
      await prisma.demoAccess.deleteMany({
        where: { productId }
      })

      console.log(`🗑️ DELETION: Successfully deleted all demo access records for product ${productId}`)
    }

    // Also check for inactive subscriptions that might still reference this product
    const inactiveSubscriptions = await prisma.subscription.count({
      where: {
        productId,
        status: {
          not: 'active'
        }
      }
    })

    if (inactiveSubscriptions > 0) {
      console.log(`🗑️ DELETION: Found ${inactiveSubscriptions} inactive subscriptions for product ${productId}, deleting them first`)

      await prisma.subscription.deleteMany({
        where: {
          productId,
          status: {
            not: 'active'
          }
        }
      })

      console.log(`🗑️ DELETION: Successfully deleted all inactive subscriptions for product ${productId}`)
    }

    console.log(`🗑️ DELETION: All related records deleted. Now deleting product ${productId}`)

    await prisma.product.delete({
      where: { productId }
    })

    console.log(`✅ DELETION: Successfully deleted product ${productId}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('🔥 DELETE ERROR: Error deleting product:', error)
    console.error('🔥 DELETE ERROR: Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      productId: productId
    })

    // Отправляем ошибку в наш error catcher
    try {
      await fetch('https://tma-subscription.vercel.app/api/catch-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          details: error instanceof Error ? error.stack : 'Unknown',
          source: 'api/admin/products DELETE',
          timestamp: new Date().toISOString(),
          user: 'product_deletion',
          context: { productId }
        })
      })
    } catch (logError) {
      console.error('🔥 DELETE ERROR: Failed to send error to logger:', logError)
    }

    // Проверяем, если это ошибка внешнего ключа
    if (error instanceof Error && error.message.includes('Foreign key constraint violated')) {
      return NextResponse.json(
        {
          error: 'Cannot delete product: it is still referenced by other records. Please contact administrator.',
          details: 'Foreign key constraint violation',
          errorId: Date.now().toString()
        },
        { status: 400 }
      )
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