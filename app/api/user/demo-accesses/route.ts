import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// Получение initData из заголовка или query параметра
function getInitData(request: NextRequest): string | null {
  // Сначала проверяем заголовок
  const initData = request.headers.get('x-telegram-init-data')
  if (initData) return initData

  // Затем проверяем query параметры
  const { searchParams } = new URL(request.url)
  return searchParams.get('initData')
}

export async function GET(request: NextRequest) {
  try {
    const initData = getInitData(request)

    if (!initData) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация Telegram' },
        { status: 401 }
      )
    }

    // Валидация initData (для тестовых данных пропускаем валидацию хеша)
    const isTestData = initData.includes('test_hash_for_development')
    if (!isTestData && !validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return NextResponse.json(
        { success: false, error: 'Неверные данные авторизации' },
        { status: 401 }
      )
    }

    // Получение ID пользователя из initData
    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')
    if (!userStr) {
      return NextResponse.json(
        { success: false, error: 'Не удалось получить данные пользователя' },
        { status: 400 }
      )
    }

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    // Получение демо-доступов пользователя
    const demoAccesses = await prisma.demoAccess.findMany({
      where: {
        userId: telegramId
      },
      include: {
        product: {
          select: {
            productId: true,
            name: true,
            demoDays: true
          }
        },
        user: {
          select: {
            telegramId: true,
            firstName: true,
            username: true
          }
        }
      },
      orderBy: {
        startedAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: demoAccesses.map(demo => ({
        id: demo.id,
        userId: demo.userId.toString(),
        productId: demo.productId,
        startedAt: demo.startedAt,
        expiresAt: demo.expiresAt,
        isActive: demo.isActive,
        reminderSent: demo.reminderSent,
        daysRemaining: Math.ceil((demo.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
        product: demo.product,
        user: demo.user
      }))
    })
  } catch (error) {
    console.error('Error fetching user demo accesses:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки демо-доступов' },
      { status: 500 }
    )
  }
}