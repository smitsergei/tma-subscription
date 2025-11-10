import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function getUserFromRequest(request: NextRequest) {
  // Сначала пробуем получить из заголовка
  const initData = request.headers.get('x-telegram-init-data')
  if (initData) {
    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')
    if (userStr) {
      return JSON.parse(decodeURIComponent(userStr))
    }
  }

  // Если в заголовке нет, пробуем из query параметров
  const { searchParams } = new URL(request.url)
  const queryInitData = searchParams.get('initData')
  if (queryInitData) {
    const urlParams = new URLSearchParams(queryInitData)
    const userStr = urlParams.get('user')
    if (userStr) {
      return JSON.parse(decodeURIComponent(userStr))
    }
  }

  return null
}

interface ApplyPromoCodeRequest {
  promoId: string
  paymentId: string
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401 }
      )
    }

    // Для тестовых данных пропускаем валидацию
    const initData = request.headers.get('x-telegram-init-data') ||
                   new URL(request.url).searchParams.get('initData') || ''
    const isTestData = initData.includes('test_hash_for_development')

    if (!isTestData && !validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return NextResponse.json(
        { success: false, error: 'Неверные данные авторизации' },
        { status: 401 }
      )
    }

    const body: ApplyPromoCodeRequest = await request.json()
    const { promoId, paymentId } = body

    if (!promoId || !paymentId) {
      return NextResponse.json(
        { success: false, error: 'Отсутствуют обязательные поля' },
        { status: 400 }
      )
    }

    // Проверяем существование промокода
    const promoCode = await prisma.promoCode.findUnique({
      where: { id: promoId }
    })

    if (!promoCode) {
      return NextResponse.json(
        { success: false, error: 'Промокод не найден' },
        { status: 404 }
      )
    }

    // Проверяем существование платежа
    const payment = await prisma.payment.findUnique({
      where: { paymentId }
    })

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Платеж не найден' },
        { status: 404 }
      )
    }

    const telegramId = BigInt(user.id)

    // Создаем запись об использовании промокода
    await prisma.promoUsage.create({
      data: {
        promoId: promoCode.id,
        userId: telegramId
      }
    })

    // Обновляем счетчик использований промокода
    await prisma.promoCode.update({
      where: { id: promoCode.id },
      data: {
        currentUses: {
          increment: 1
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Промокод успешно применен'
    })

  } catch (error) {
    console.error('Error applying promo code:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка применения промокода' },
      { status: 500 }
    )
  }
}