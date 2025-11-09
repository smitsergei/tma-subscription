import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET - получение детальной информации о платеже
export async function GET(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const { paymentId } = params

    const payment = await prisma.payment.findUnique({
      where: { paymentId },
      include: {
        user: true,
        product: {
          include: {
            channel: true
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

    // Конвертация BigInt в строки
    const formattedPayment = {
      ...payment,
      userId: payment.userId.toString(),
      user: payment.user ? {
        ...payment.user,
        telegramId: payment.user.telegramId.toString()
      } : null,
      product: payment.product ? {
        ...payment.product,
        channel: payment.product.channel ? {
          ...payment.product.channel,
          channelId: payment.product.channel.channelId.toString()
        } : null
      } : null
    }

    // Проверка связанных подписок
    const subscriptions = await prisma.subscription.findMany({
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
            periodDays: true
          }
        },
        channel: {
          select: {
            name: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const formattedSubscriptions = subscriptions.map(sub => ({
      ...sub,
      userId: sub.userId.toString(),
      user: sub.user ? {
        ...sub.user,
        telegramId: sub.user.telegramId.toString()
      } : null,
      channelId: sub.channelId.toString()
    }))

    return NextResponse.json({
      success: true,
      data: {
        payment: formattedPayment,
        subscriptions: formattedSubscriptions
      }
    })

  } catch (error) {
    console.error('Error fetching payment details:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка получения деталей платежа' },
      { status: 500 }
    )
  }
}