import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing demo delete functionality...')

    // Получаем демо-доступы для тестирования
    const demoAccesses = await prisma.demoAccess.findMany({
      take: 5,
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
            channel: {
              select: {
                channelId: true,
                name: true
              }
            }
          }
        }
      }
    })

    console.log(`✅ Found ${demoAccesses.length} demo accesses for testing`)

    return NextResponse.json({
      success: true,
      message: 'Demo delete test endpoint - ready for testing',
      demoAccesses: demoAccesses.map(demo => ({
        id: demo.id,
        user: {
          telegramId: demo.user.telegramId.toString(),
          firstName: demo.user.firstName,
          username: demo.user.username
        },
        product: {
          productId: demo.product.productId,
          name: demo.product.name,
          channel: {
            channelId: demo.product.channel.channelId.toString(),
            name: demo.product.channel.name
          }
        },
        startedAt: demo.startedAt.toISOString(),
        expiresAt: demo.expiresAt.toISOString(),
        isActive: demo.isActive,
        daysRemaining: Math.ceil((demo.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      })),
      availableEndpoints: {
        listAll: '/api/admin/demo/access',
        grantDemo: '/api/admin/demo/grant',
        extendDemo: '/api/admin/demo/extend/{id}',
        revokeDemo: '/api/admin/demo/revoke/{id}',
        deleteDemo: '/api/admin/demo/delete/{id}'
      },
      environment: {
        botToken: !!process.env.BOT_TOKEN,
        appUrl: process.env.APP_URL,
        nodeEnv: process.env.NODE_ENV
      }
    })

  } catch (error) {
    console.error('❌ Error testing demo delete functionality:', error)
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
    console.log('🧪 Testing demo delete POST...')

    const body = await request.json()
    const { demoId } = body

    if (!demoId) {
      return NextResponse.json(
        {
          success: false,
          error: 'demoId is required in request body'
        },
        { status: 400 }
      )
    }

    // Проверяем существование демо-доступа
    const existingDemo = await prisma.demoAccess.findUnique({
      where: { id: demoId },
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
            channel: {
              select: {
                channelId: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!existingDemo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Демо-доступ не найден'
        },
        { status: 404 }
      )
    }

    console.log('🔍 Found demo access for test deletion:', {
      id: existingDemo.id,
      user: existingDemo.user.firstName,
      product: existingDemo.product.name,
      isActive: existingDemo.isActive
    })

    return NextResponse.json({
      success: true,
      message: 'Demo access found and ready for deletion',
      testMode: true,
      demoAccess: {
        id: existingDemo.id,
        user: {
          telegramId: existingDemo.user.telegramId.toString(),
          firstName: existingDemo.user.firstName,
          username: existingDemo.user.username
        },
        product: {
          productId: existingDemo.product.productId,
          name: existingDemo.product.name,
          channel: {
            channelId: existingDemo.product.channel.channelId.toString(),
            name: existingDemo.product.channel.name
          }
        },
        startedAt: existingDemo.startedAt.toISOString(),
        expiresAt: existingDemo.expiresAt.toISOString(),
        isActive: existingDemo.isActive,
        daysRemaining: Math.ceil((existingDemo.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      },
      nextSteps: {
        actualDelete: `Send DELETE request to /api/admin/demo/delete/${demoId}`,
        adminPanel: 'Use the admin panel at /admin for safe deletion'
      }
    })

  } catch (error) {
    console.error('❌ Error in demo delete test POST:', error)
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