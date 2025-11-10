import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const initData = request.headers.get('x-telegram-init-data')
  if (!initData) return false

  if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) return false

  const urlParams = new URLSearchParams(initData)
  const userStr = urlParams.get('user')
  if (!userStr) return false

  const user = JSON.parse(decodeURIComponent(userStr))
  const telegramId = BigInt(user.id)

  let admin = await prisma.admin.findUnique({
    where: { telegramId }
  })

  if (!admin) {
    // Создаем админа если его нет (для тестовых данных)
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

      admin = await prisma.admin.findUnique({
        where: { telegramId }
      })
    } catch (createError) {
      console.error('🔍 AUTH: Failed to create admin record:', createError)
      return false
    }
  }

  return !!admin
}

export async function GET(request: NextRequest) {
  try {
    // Проверка прав администратора
    const isAdmin = await checkAdminAuth(request)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    // Получение последних подписок
    const subscriptions = await prisma.subscription.findMany({
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
            periodDays: true
          }
        },
        channel: {
          select: {
            channelId: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10 // Последние 10 подписок
    })

    return NextResponse.json({
      success: true,
      data: subscriptions.map(subscription => ({
        ...subscription,
        userId: subscription.userId.toString(),
        productId: subscription.productId,
        channelId: subscription.channelId.toString(),
        user: subscription.user ? {
          ...subscription.user,
          telegramId: subscription.user.telegramId.toString()
        } : null,
        channel: subscription.channel ? {
          ...subscription.channel,
          channelId: subscription.channel.channelId.toString()
        } : null
      }))
    })
  } catch (error) {
    console.error('Error fetching recent subscriptions:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки подписок' },
      { status: 500 }
    )
  }
}