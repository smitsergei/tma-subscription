import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'
import { Decimal } from 'decimal.js'

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

interface ValidatePromoCodeRequest {
  code: string
  productId: string
  amount: number
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

    const body: ValidatePromoCodeRequest = await request.json()
    const { code, productId, amount } = body

    if (!code || !productId || !amount) {
      return NextResponse.json(
        { success: false, error: 'Отсутствуют обязательные поля' },
        { status: 400 }
      )
    }

    // Ищем промокод
    const promoCode = await prisma.promoCode.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true
      },
      include: {
        product: {
          select: {
            productId: true,
            name: true,
            price: true
          }
        },
        _count: {
          select: {
            usageHistory: true
          }
        }
      }
    })

    if (!promoCode) {
      return NextResponse.json(
        { success: false, error: 'Промокод не найден или неактивен' },
        { status: 404 }
      )
    }

    // Проверяем дату действия
    const now = new Date()
    const validFrom = new Date(promoCode.validFrom)
    const validUntil = new Date(promoCode.validUntil)

    if (now < validFrom || now > validUntil) {
      return NextResponse.json(
        { success: false, error: 'Срок действия промокода истек' },
        { status: 400 }
      )
    }

    // Проверяем лимит использований
    if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
      return NextResponse.json(
        { success: false, error: 'Лимит использований промокода исчерпан' },
        { status: 400 }
      )
    }

    // Проверяем минимальную сумму
    if (promoCode.minAmount && amount < parseFloat(promoCode.minAmount.toString())) {
      return NextResponse.json(
        {
          success: false,
          error: `Минимальная сумма для использования промокода: $${promoCode.minAmount}`
        },
        { status: 400 }
      )
    }

    // Проверяем применимость к продукту
    if (promoCode.productId && promoCode.productId !== productId) {
      return NextResponse.json(
        { success: false, error: 'Промокод не применим к данному продукту' },
        { status: 400 }
      )
    }

    // Проверяем, не использовал ли уже этот пользователь промокод
    const telegramId = BigInt(user.id)
    const existingUsage = await prisma.promoUsage.findFirst({
      where: {
        promoId: promoCode.id,
        userId: telegramId
      }
    })

    if (existingUsage) {
      return NextResponse.json(
        { success: false, error: 'Вы уже использовали этот промокод' },
        { status: 400 }
      )
    }

    // Рассчитываем скидку
    let discountAmount = new Decimal(0)
    let finalAmount = new Decimal(amount)

    if (promoCode.type === 'PERCENTAGE') {
      discountAmount = finalAmount.mul(promoCode.discountValue.div(100))
      finalAmount = finalAmount.sub(discountAmount)
    } else if (promoCode.type === 'FIXED_AMOUNT') {
      discountAmount = new Decimal(promoCode.discountValue.toString())
      finalAmount = finalAmount.sub(discountAmount)
    }

    // Не допускаем отрицательную сумму
    if (finalAmount.lt(0)) {
      finalAmount = new Decimal(0)
    }

    return NextResponse.json({
      success: true,
      data: {
        promoCode: {
          id: promoCode.id,
          code: promoCode.code,
          type: promoCode.type,
          discountValue: parseFloat(promoCode.discountValue.toString()),
          discountAmount: parseFloat(discountAmount.toString()),
          finalAmount: parseFloat(finalAmount.toString()),
          originalAmount: amount,
          product: promoCode.product
        }
      }
    })

  } catch (error) {
    console.error('Error validating promo code:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка проверки промокода' },
      { status: 500 }
    )
  }
}