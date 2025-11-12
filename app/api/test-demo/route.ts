import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing demo functionality...')

    const now = new Date()

    // Получаем статистику демо-доступов
    const totalDemoAccesses = await prisma.demoAccess.count()
    const activeDemoAccesses = await prisma.demoAccess.count({
      where: {
        isActive: true,
        expiresAt: { gt: now }
      }
    })
    const expiredDemoAccesses = await prisma.demoAccess.count({
      where: {
        isActive: true,
        expiresAt: { lt: now }
      }
    })

    // Получаем последние демо-доступы с подробной информацией
    const recentDemoAccesses = await prisma.demoAccess.findMany({
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
            allowDemo: true,
            demoDays: true,
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

    // Проверяем продукты с демо-доступом
    const productsWithDemo = await prisma.product.count({
      where: {
        allowDemo: true,
        isActive: true
      }
    })

    console.log('✅ Demo functionality test completed')

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      stats: {
        totalDemoAccesses,
        activeDemoAccesses,
        expiredDemoAccesses,
        productsWithDemo
      },
      recentDemoAccesses: recentDemoAccesses.map(demo => ({
        id: demo.id,
        user: {
          telegramId: demo.user.telegramId.toString(),
          firstName: demo.user.firstName,
          username: demo.user.username
        },
        product: {
          productId: demo.product.productId,
          name: demo.product.name,
          demoDays: demo.product.demoDays,
          channel: {
            channelId: demo.product.channel.channelId.toString(),
            name: demo.product.channel.name
          }
        },
        startedAt: demo.startedAt.toISOString(),
        expiresAt: demo.expiresAt.toISOString(),
        isActive: demo.isActive,
        daysRemaining: Math.ceil((demo.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      })),
      environment: {
        botToken: !!process.env.BOT_TOKEN,
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
        cronSecret: !!process.env.CRON_SECRET
      }
    })

  } catch (error) {
    console.error('❌ Error testing demo functionality:', error)
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