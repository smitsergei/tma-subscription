import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generatePaymentMemo } from '@/lib/utils'

interface CreateOldPaymentRequest {
  productId: string
  amount?: number
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 DEBUG: Received request to create old payment')

    const body: CreateOldPaymentRequest = await request.json()
    const { productId, amount = 1 } = body

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Проверка существования продукта
    const product = await prisma.product.findUnique({
      where: { productId },
      include: { channel: true }
    })

    if (!product || !product.isActive) {
      return NextResponse.json(
        { success: false, error: 'Product not found or inactive' },
        { status: 404 }
      )
    }

    // Генерация уникального memo для платежа
    const memo = generatePaymentMemo()

    // Создание тестового платежа со старым timestamp (10 минут назад)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    const payment = await prisma.payment.create({
      data: {
        userId: BigInt(123456), // Тестовый пользователь
        productId,
        amount: amount,
        currency: 'USDT',
        status: 'pending',
        memo,
        createdAt: tenMinutesAgo,
        updatedAt: tenMinutesAgo
      }
    })

    console.log(`✅ DEBUG: Created old test payment: ${payment.paymentId}`)

    return NextResponse.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        memo: payment.memo,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        createdAt: payment.createdAt,
        product: {
          name: product.name,
          channel: product.channel.name
        }
      }
    })

  } catch (error) {
    console.error('🔍 DEBUG: Error creating old payment:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}