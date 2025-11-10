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

  const admin = await prisma.admin.findUnique({
    where: { telegramId }
  })

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

    // Получение статистики
    const [
      totalUsers,
      activeSubscriptions,
      totalRevenue,
      totalProducts
    ] = await Promise.all([
      // Всего пользователей
      prisma.user.count(),

      // Активные подписки
      prisma.subscription.count({
        where: {
          status: 'active',
          expiresAt: {
            gt: new Date()
          }
        }
      }),

      // Общая выручка (успешные платежи)
      prisma.payment.aggregate({
        where: {
          status: 'success'
        },
        _sum: {
          amount: true
        }
      }),

      // Всего активных продуктов
      prisma.product.count({
        where: {
          isActive: true
        }
      })
    ])

    const stats = {
      totalUsers,
      activeSubscriptions,
      totalRevenue: totalRevenue._sum.amount ? parseFloat(totalRevenue._sum.amount.toString()) : 0,
      totalProducts
    }

    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки статистики' },
      { status: 500 }
    )
  }
}