import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generatePaymentMemo } from '@/lib/utils'

interface CreateTestPaymentRequest {
  productId: string
  userId?: string // Опциональный ID пользователя для теста
  amount?: number
}

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 TEST: Creating test payment')

    const body: CreateTestPaymentRequest = await request.json()
    const { productId, userId = '123456', amount = 1 } = body

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

    // Создание тестового платежа
    const payment = await prisma.payment.create({
      data: {
        userId: BigInt(userId),
        productId,
        amount: amount,
        currency: 'USDT',
        status: 'pending',
        memo
      }
    })

    console.log(`✅ TEST: Created test payment: ${payment.paymentId}`)

    return NextResponse.json({
      success: true,
      data: {
        paymentId: payment.paymentId,
        memo: payment.memo,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        product: {
          name: product.name,
          channel: product.channel.name
        },
        // Инструкция для тестирования
        testInstructions: {
          walletAddress: process.env.TON_WALLET_ADDRESS,
          memo: payment.memo,
          amount: `${amount} USDT`,
          note: 'Отправьте эту сумму на указанный адрес с точным memo для тестирования'
        }
      }
    })

  } catch (error) {
    console.error('🧪 TEST: Error creating test payment:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}