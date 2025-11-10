import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export const dynamic = 'force-dynamic'

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

    const discountId = params.id
    const body = await request.json()

    // Проверяем существование скидки
    const existingDiscount = await prisma.discount.findUnique({
      where: { id: discountId }
    })

    if (!existingDiscount) {
      return createJsonResponse(
        { error: 'Discount not found' },
        404
      )
    }

    let updateData: any = {}

    if (body.type !== undefined) updateData.type = body.type
    if (body.value !== undefined) updateData.value = parseFloat(body.value)
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.startDate !== undefined) updateData.startDate = new Date(body.startDate)
    if (body.endDate !== undefined) updateData.endDate = new Date(body.endDate)

    const discount = await prisma.discount.update({
      where: { id: discountId },
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
    const serializedDiscount = {
      id: discount.id,
      productId: discount.productId,
      type: discount.type,
      value: parseFloat(discount.value.toString()),
      isActive: discount.isActive,
      startDate: discount.startDate.toISOString(),
      endDate: discount.endDate.toISOString(),
      createdAt: discount.createdAt.toISOString(),
      updatedAt: discount.updatedAt.toISOString(),
      product: discount.product
    }

    return createJsonResponse({ discount: serializedDiscount })

  } catch (error) {
    console.error('Error updating discount:', error)
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

    const discountId = params.id

    // Проверяем существование скидки
    const existingDiscount = await prisma.discount.findUnique({
      where: { id: discountId }
    })

    if (!existingDiscount) {
      return createJsonResponse(
        { error: 'Discount not found' },
        404
      )
    }

    await prisma.discount.delete({
      where: { id: discountId }
    })

    return createJsonResponse({ success: true })

  } catch (error) {
    console.error('Error deleting discount:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}