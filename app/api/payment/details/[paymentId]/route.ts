import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Decimal } from 'decimal.js'

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

  // Если у нас есть все данные NOWPayments в базе, возвращаем их
    if (payment.payAddress && payment.payAmount && payment.validUntil) {
      return NextResponse.json({
        success: true,
        payment: {
          payment_id: payment.paymentId,
          payment_status: payment.status,
          pay_address: payment.payAddress,
          price_amount: Number(payment.priceAmount || payment.amount),
          price_currency: payment.priceCurrency || payment.currency,
          pay_amount: Number(payment.payAmount),
          pay_currency: payment.payCurrency,
          order_id: payment.paymentId,
          order_description: payment.orderDescription || `Платеж за ${payment.product?.name || 'продукт'}`,
          created_at: payment.createdAt.toISOString(),
          valid_until: payment.validUntil.toISOString()
        }
      })
    }

    // Если данных в базе нет, попробуем получить из NOWPayments API
    if (payment.nowPaymentId) {
      const apiKey = process.env.NOWPAYMENTS_API_KEY
      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: 'API ключ не настроен' },
          { status: 500 }
        )
      }

      const response = await fetch(`https://api.nowpayments.io/v1/payment/${payment.nowPaymentId}`, {
        headers: {
          'x-api-key': apiKey,
        },
      })

      if (response.ok) {
        const nowPaymentData = await response.json()

        // Обновляем данные в базе
        await prisma.payment.update({
          where: { paymentId },
          data: {
            payAddress: nowPaymentData.pay_address,
            payAmount: nowPaymentData.pay_amount ? new Decimal(nowPaymentData.pay_amount.toString()) : null,
            payCurrency: nowPaymentData.pay_currency,
            validUntil: nowPaymentData.valid_until ? new Date(nowPaymentData.valid_until) : null,
            priceAmount: nowPaymentData.price_amount ? new Decimal(nowPaymentData.price_amount.toString()) : null,
            priceCurrency: nowPaymentData.price_currency,
          }
        })

        return NextResponse.json({
          success: true,
          payment: nowPaymentData
        })
      } else {
        console.error('NOWPayments API error:', response.status, await response.text())
      }
    }

    // Если не удалось получить данные ниоткуда, возвращаем базовую информацию
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
        created_at: payment.createdAt.toISOString(),
        valid_until: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 минут
      }
    })

  } catch (error) {
    console.error('Error fetching payment details:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки деталей платежа' },
      { status: 500 }
    )
  }
}