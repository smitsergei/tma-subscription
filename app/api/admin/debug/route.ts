import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Starting debug endpoint')

    // Проверяем заголовки
    const initData = request.headers.get('x-telegram-init-data')
    console.log('🔍 DEBUG: InitData present:', !!initData)
    console.log('🔍 DEBUG: InitData length:', initData?.length || 0)

    if (initData) {
      console.log('🔍 DEBUG: InitData preview:', initData.substring(0, 100) + '...')

      // Валидация
      const isValid = validateTelegramInitData(initData, process.env.BOT_TOKEN!)
      console.log('🔍 DEBUG: InitData validation result:', isValid)

      if (isValid) {
        const urlParams = new URLSearchParams(initData)
        const userStr = urlParams.get('user')
        console.log('🔍 DEBUG: User string present:', !!userStr)

        if (userStr) {
          const user = JSON.parse(decodeURIComponent(userStr))
          console.log('🔍 DEBUG: Parsed user:', user)

          // Проверяем админа
          const admin = await prisma.admin.findUnique({
            where: { telegramId: BigInt(user.id) },
            include: {
              user: {
                select: {
                  telegramId: true,
                  firstName: true,
                  username: true
                }
              }
            }
          })
          console.log('🔍 DEBUG: Admin found:', !!admin)
          if (admin) {
            console.log('🔍 DEBUG: Admin user:', admin.user)
          }
        }
      }
    }

    // Проверяем количество продуктов в базе
    const productCount = await prisma.product.count()
    console.log('🔍 DEBUG: Total products in DB:', productCount)

    // Получаем все продукты с полной информацией
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

    console.log('🔍 DEBUG: Products found:', products.length)
    products.forEach(p => {
      console.log(`🔍 DEBUG: Product ${p.productId}: ${p.name}, Channel: ${p.channel?.name || 'None'}`)
    })

    // Проверяем количество пользователей
    const userCount = await prisma.user.count()
    console.log('🔍 DEBUG: Total users in DB:', userCount)

    // Проверяем количество каналов
    const channelCount = await prisma.channel.count()
    console.log('🔍 DEBUG: Total channels in DB:', channelCount)

    return NextResponse.json({
      success: true,
      debug: {
        auth: {
          initDataPresent: !!initData,
          initDataLength: initData?.length || 0,
          validationValid: initData ? validateTelegramInitData(initData, process.env.BOT_TOKEN!) : false
        },
        database: {
          productCount,
          userCount,
          channelCount,
          products: products.map(p => ({
            id: p.productId,
            name: p.name,
            price: p.price,
            channelName: p.channel?.name || 'None',
            channelId: p.channel?.channelId.toString() || 'None',
            isActive: p.isActive,
            subscriptionCount: p._count.subscriptions
          }))
        }
      }
    })

  } catch (error) {
    console.error('🔍 DEBUG: Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        stack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 })
  }
}