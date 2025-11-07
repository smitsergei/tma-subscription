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
      return false
    }

    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return false
    }

    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')

    if (!userStr) {
      return false
    }

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    const admin = await prisma.admin.findUnique({
      where: { telegramId }
    })

    return !!admin
  } catch (error) {
    console.error('Auth error:', error)
    return false
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const promoId = params.id
    const body = await request.json()

    // Проверяем существование промокода
    const existingPromoCode = await prisma.promoCode.findUnique({
      where: { id: promoId }
    })

    if (!existingPromoCode) {
      return createJsonResponse(
        { error: 'Promo code not found' },
        404
      )
    }

    let updateData: any = {}

    if (body.type !== undefined) updateData.type = body.type
    if (body.discountValue !== undefined) updateData.discountValue = parseFloat(body.discountValue)
    if (body.productId !== undefined) updateData.productId = body.productId || null
    if (body.maxUses !== undefined) updateData.maxUses = body.maxUses ? parseInt(body.maxUses) : null
    if (body.minAmount !== undefined) updateData.minAmount = body.minAmount ? parseFloat(body.minAmount) : null
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.validFrom !== undefined) updateData.validFrom = new Date(body.validFrom)
    if (body.validUntil !== undefined) updateData.validUntil = new Date(body.validUntil)

    // Если productId указан, проверяем что продукт существует
    if (updateData.productId) {
      const product = await prisma.product.findUnique({
        where: { productId: updateData.productId }
      })

      if (!product) {
        return createJsonResponse(
          { error: 'Product not found' },
          404
        )
      }
    }

    const promoCode = await prisma.promoCode.update({
      where: { id: promoId },
      data: updateData,
      include: {
        product: {
          select: {
            productId: true,
            name: true,
            price: true
          }
        }
      }
    })

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
    console.error('Error updating promo code:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const promoId = params.id

    // Проверяем существование промокода
    const existingPromoCode = await prisma.promoCode.findUnique({
      where: { id: promoId }
    })

    if (!existingPromoCode) {
      return createJsonResponse(
        { error: 'Promo code not found' },
        404
      )
    }

    await prisma.promoCode.delete({
      where: { id: promoId }
    })

    return createJsonResponse({ success: true })

  } catch (error) {
    console.error('Error deleting promo code:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}