import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const paymentId = params.paymentId

    // Получаем платеж из нашей базы данных
    const payment = await prisma.payment.findUnique({
      where: { paymentId },
      include: {
        user: {
          select: {
            telegramId: true,
            username: true,
            firstName: true
          }
        },
        product: {
          select: {
            name: true,
            price: true,
            periodDays: true,
            channel: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Платеж не найден' },
        { status: 404 }
      )
    }

    // Получаем детали платежа из NOWPayments API
    const apiKey = process.env.NOWPAYMENTS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API ключ не настроен' },
        { status: 500 }
      )
    }

    const response = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
      headers: {
        'x-api-key': apiKey,
      },
    })

    if (!response.ok) {
      console.error('NOWPayments API error:', response.status, await response.text())
      // Если не можем получить детали из NOWPayments, возвращаем то что есть
      return NextResponse.json({
        success: true,
        payment: {
          payment_id: payment.paymentId,
          payment_status: payment.status,
          order_id: payment.paymentId,
          order_description: `Платеж за ${payment.product?.name || 'продукт'}`,
          price_amount: Number(payment.amount),
          price_currency: payment.currency,
          pay_currency: payment.currency,
          pay_amount: Number(payment.amount),
          pay_address: 'Адрес будет доступен после подтверждения',
          created_at: payment.createdAt,
          valid_until: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 минут
        }
      })
    }

    const nowPaymentData = await response.json()

    return NextResponse.json({
      success: true,
      payment: nowPaymentData
    })

  } catch (error) {
    console.error('Error fetching payment details:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки деталей платежа' },
      { status: 500 }
    )
  }
}