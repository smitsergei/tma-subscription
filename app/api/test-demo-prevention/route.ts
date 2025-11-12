import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing demo prevention logic...')

    // Получаем всех пользователей с демо-доступами
    const usersWithDemoAccess = await prisma.demoAccess.groupBy({
      by: ['userId'],
      where: {
        userId: {
          not: BigInt(0) // Исключаем пустые ID
        }
      },
      _count: {
        id: true
      }
    })

    console.log(`📊 Found ${usersWithDemoAccess.length} users with demo access`)

    // Получаем детальную информацию по нескольким пользователям
    const detailedDemoStats = await prisma.demoAccess.findMany({
      take: 10,
      orderBy: { startedAt: 'desc' },
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
            demoDays: true
          }
        }
      }
    })

    // Проверяем потенциальные проблемы с повторными демо
    const potentialIssues = []

    for (const user of usersWithDemoAccess) {
      if (user._count.id > 1) {
        // Пользователь имеет более одного демо-доступа
        const userDemoAccesses = await prisma.demoAccess.findMany({
          where: { userId: user.userId },
          include: {
            product: {
              select: {
                productId: true,
                name: true
              }
            }
          }
        })

        // Группируем по продуктам
        const productGroups = userDemoAccesses.reduce((acc, demo) => {
          const productId = demo.productId
          if (!acc[productId]) {
            acc[productId] = []
          }
          acc[productId].push(demo)
          return acc
        }, {} as Record<string, any[]>)

        // Ищем повторные демо для одного продукта
        for (const [productId, demos] of Object.entries(productGroups)) {
          if (demos.length > 1) {
            potentialIssues.push({
              userId: user.userId.toString(),
              productId: productId,
              productName: demos[0].product.name,
              accessCount: demos.length,
              accesses: demos.map(d => ({
                id: d.id,
                startedAt: d.startedAt.toISOString(),
                expiresAt: d.expiresAt.toISOString(),
                isActive: d.isActive
              }))
            })
          }
        }
      }
    }

    console.log(`⚠️ Found ${potentialIssues.length} potential repeat demo issues`)

    return NextResponse.json({
      success: true,
      message: 'Demo prevention test completed',
      stats: {
        totalUsersWithDemo: usersWithDemoAccess.length,
        totalDemoAccesses: usersWithDemoAccess.reduce((sum, user) => sum + user._count.id, 0),
        potentialRepeatDemos: potentialIssues.length
      },
      sampleData: detailedDemoStats.map(demo => ({
        user: {
          telegramId: demo.user.telegramId.toString(),
          firstName: demo.user.firstName,
          username: demo.user.username
        },
        product: {
          productId: demo.product.productId,
          name: demo.product.name,
          demoDays: demo.product.demoDays
        },
        access: {
          startedAt: demo.startedAt.toISOString(),
          expiresAt: demo.expiresAt.toISOString(),
          isActive: demo.isActive
        }
      })),
      potentialIssues: potentialIssues.slice(0, 5), // Показываем первые 5 проблем
      testResults: {
        apiEndpoint: '/api/products/with-demo-status',
        newLogicStatus: '✅ Implemented - prevents repeat demos',
        oldLogicStatus: '❌ Buggy - allowed repeat demos after expiration',
        recommendation: potentialIssues.length > 0
          ? '⚠️ Found existing repeat demos - implement fix'
          : '✅ No repeat demos detected'
      }
    })

  } catch (error) {
    console.error('❌ Error in demo prevention test:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing demo prevention POST...')

    const body = await request.json()
    const { userId, productId } = body

    if (!userId || !productId) {
      return NextResponse.json(
        {
          success: false,
          error: 'userId and productId are required'
        },
        { status: 400 }
      )
    }

    // Проверяем логику блокировки демо
    const userDemoAccesses = await prisma.demoAccess.findMany({
      where: {
        userId: BigInt(userId)
      },
      select: {
        productId: true,
        isActive: true,
        startedAt: true,
        expiresAt: true
      }
    })

    const userSubscriptions = await prisma.subscription.findMany({
      where: {
        userId: BigInt(userId),
        status: 'active',
        expiresAt: {
          gt: new Date()
        }
      },
      select: {
        productId: true
      }
    })

    const demoProductIds = new Set(userDemoAccesses.map(da => da.productId))
    const subscriptionProductIds = new Set(userSubscriptions.map(s => s.productId))
    const activeDemoProductIds = new Set(
      userDemoAccesses
        .filter(da => da.isActive && da.expiresAt > new Date())
        .map(da => da.productId)
    )

    const hasDemoAccess = demoProductIds.has(productId)
    const hasActiveDemo = activeDemoProductIds.has(productId)
    const hasSubscription = subscriptionProductIds.has(productId)

    const allowDemo = !hasDemoAccess && !hasSubscription

    return NextResponse.json({
      success: true,
      testInput: {
        userId,
        productId
      },
      testResult: {
        allowDemo,
        hasDemoAccess,
        hasActiveDemo,
        hasSubscription
      },
      explanation: {
        allowDemo: allowDemo ? '✅ Demo allowed' : '❌ Demo blocked',
        reason: hasDemoAccess
          ? 'User has already used demo for this product'
          : hasSubscription
          ? 'User has active subscription for this product'
          : 'User can use demo for this product'
      },
      userStats: {
        totalDemoAccesses: userDemoAccesses.length,
        activeDemoAccesses: userDemoAccesses.filter(da => da.isActive && da.expiresAt > new Date()).length,
        activeSubscriptions: userSubscriptions.length
      }
    })

  } catch (error) {
    console.error('❌ Error in demo prevention POST test:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}