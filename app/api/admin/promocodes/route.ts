import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

// Утилита для безопасной сериализации BigInt
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}

// Функция для создания аутентифицированного ответа
function createJsonResponse(data: any, status: number = 200): NextResponse {
  return new NextResponse(safeStringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// Функция для проверки админ прав
async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  try {
    const initData = request.headers.get('x-telegram-init-data');

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
      console.log('🔍 AUTH: No user string found')
      return false
    }

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    const admin = await prisma.admin.findUnique({
      where: { telegramId }
    })

    if (!admin) {
      console.log('🔍 AUTH: Admin not found, creating...')

      // Создаем админа если его нет
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

        console.log('🔍 AUTH: Admin record created successfully')
        return true
      } catch (createError) {
        console.error('🔍 AUTH: Failed to create admin record:', createError)
        return false
      }
    }

    console.log('🔍 AUTH: Admin found: true')
    return true
  } catch (error) {
    console.error('🔍 AUTH: Error parsing user data:', error)
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const promoCodes = await prisma.promoCode.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true
          }
        },
        _count: {
          select: {
            usageHistory: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Конвертируем BigInt в string
    const serializedPromoCodes = promoCodes.map(promoCode => ({
      id: promoCode.id,
      code: promoCode.code,
      type: promoCode.type,
      discountValue: parseFloat(promoCode.discountValue.toString()),
      productId: promoCode.productId,
      maxUses: promoCode.maxUses,
      currentUses: promoCode.currentUses,
      minAmount: promoCode.minAmount ? parseFloat(promoCode.minAmount.toString()) : undefined,
      isActive: promoCode.isActive,
      validFrom: promoCode.validFrom.toISOString(),
      validUntil: promoCode.validUntil.toISOString(),
      createdAt: promoCode.createdAt.toISOString(),
      product: promoCode.product,
      _count: promoCode._count
    }))

    return createJsonResponse({ promoCodes: serializedPromoCodes })

  } catch (error) {
    console.error('Error fetching promo codes:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { code, type, discountValue, productId, maxUses, minAmount, isActive, validFrom, validUntil } = body

    if (!code || !type || discountValue === undefined || !validFrom || !validUntil) {
      return createJsonResponse(
        { error: 'Missing required fields' },
        400
      )
    }

    console.log('🔍 Creating promo code with data:', {
      code,
      type,
      discountValue: parseFloat(discountValue),
      productId,
      maxUses,
      minAmount,
      isActive: isActive !== false,
      validFrom,
      validUntil
    })

    // Проверяем уникальность кода
    const existingPromoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() }
    })

    if (existingPromoCode) {
      return createJsonResponse(
        { error: 'Promo code already exists' },
        400
      )
    }

    // Если указан productId, проверяем что продукт существует
    let product = null
    if (productId) {
      product = await prisma.product.findUnique({
        where: { productId }
      })

      if (!product) {
        return createJsonResponse(
          { error: 'Product not found' },
          404
        )
      }
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        type,
        discountValue: parseFloat(discountValue),
        productId: productId || null,
        maxUses: maxUses ? parseInt(maxUses) : null,
        minAmount: minAmount ? parseFloat(minAmount) : null,
        isActive: isActive !== false,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil)
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true
          }
        }
      }
    })

    console.log('🔍 Promo code created successfully:', promoCode.id)

    // Конвертируем BigInt в string
    const serializedPromoCode = {
      id: promoCode.id,
      code: promoCode.code,
      type: promoCode.type,
      discountValue: parseFloat(promoCode.discountValue.toString()),
      productId: promoCode.productId,
      maxUses: promoCode.maxUses,
      currentUses: promoCode.currentUses,
      minAmount: promoCode.minAmount ? parseFloat(promoCode.minAmount.toString()) : undefined,
      isActive: promoCode.isActive,
      validFrom: promoCode.validFrom.toISOString(),
      validUntil: promoCode.validUntil.toISOString(),
      createdAt: promoCode.createdAt.toISOString(),
      product: promoCode.product
    }

    return createJsonResponse({ promoCode: serializedPromoCode })

  } catch (error) {
    console.error('Error creating promo code:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

// Валидация промокода
export async function POST_validate(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, productId, amount } = body

    if (!code) {
      return createJsonResponse(
        { error: 'Promo code is required' },
        400
      )
    }

    const promoCode = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true
          }
        }
      }
    })

    if (!promoCode) {
      return createJsonResponse(
        { error: 'Promo code not found' },
        404
      )
    }

    // Проверяем активности
    if (!promoCode.isActive) {
      return createJsonResponse(
        { error: 'Promo code is not active' },
        400
      )
    }

    // Проверяем срок действия
    const now = new Date()
    const validFrom = new Date(promoCode.validFrom)
    const validUntil = new Date(promoCode.validUntil)

    if (now < validFrom || now > validUntil) {
      return createJsonResponse(
        { error: 'Promo code is expired or not yet valid' },
        400
      )
    }

    // Проверяем количество использований
    if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
      return createJsonResponse(
        { error: 'Promo code usage limit reached' },
        400
      )
    }

    // Проверяем применимость к продукту
    if (promoCode.productId && productId && promoCode.productId !== productId) {
      return createJsonResponse(
        { error: 'Promo code is not applicable to this product' },
        400
      )
    }

    // Проверяем минимальную сумму
    if (promoCode.minAmount && (!amount || parseFloat(amount) < promoCode.minAmount)) {
      return createJsonResponse(
        {
          error: `Minimum order amount is $${promoCode.minAmount}`,
          minAmount: promoCode.minAmount
        },
        400
      )
    }

    return createJsonResponse({
      valid: true,
      promoCode: {
        id: promoCode.id,
        code: promoCode.code,
        type: promoCode.type,
        discountValue: parseFloat(promoCode.discountValue.toString()),
        productId: promoCode.productId,
        minAmount: promoCode.minAmount ? parseFloat(promoCode.minAmount.toString()) : undefined,
        product: promoCode.product
      }
    })

  } catch (error) {
    console.error('Error validating promo code:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}