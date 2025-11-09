import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface PaymentMonitorRequest {
  productId?: string
  userId?: string
}

// Получаем все pending платежи для мониторинга
async function getPendingPayments() {
  return await prisma.payment.findMany({
    where: {
      status: 'pending',
      createdAt: {
        // Ищем платежи не старше 30 минут
        gte: new Date(Date.now() - 30 * 60 * 1000)
      }
    },
    include: {
      product: {
        include: { channel: true }
      },
      user: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  })
}

// Проверяем конкретный платеж через Toncenter API
async function checkPaymentTransaction(payment: any): Promise<boolean> {
  try {
    console.log('🔍 MONITOR: Checking payment:', payment.paymentId)

    if (!process.env.TONCENTER_API_KEY) {
      console.error('🔍 MONITOR: TONCENTER_API_KEY not configured')
      return false
    }

    // Получаем последние транзакции кошелька
    const response = await fetch('https://toncenter.com/api/v2/getTransactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TONCENTER_API_KEY
      },
      body: JSON.stringify({
        address: process.env.TON_WALLET_ADDRESS,
        limit: 50,
        to_lt: 0,
        archival: true
      })
    })

    if (!response.ok) {
      console.error('🔍 MONITOR: Failed to fetch transactions from Toncenter')
      return false
    }

    const data = await response.json()

    if (!data.ok || !data.result) {
      console.error('🔍 MONITOR: Invalid response from Toncenter')
      return false
    }

    // Ищем транзакцию с нужным memo
    const targetTransaction = data.result.find((tx: any) => {
      const message = tx.in_msg?.message || ''
      return message === payment.memo
    })

    if (!targetTransaction) {
      console.log('🔍 MONITOR: Transaction not found for payment:', payment.paymentId)
      return false
    }

    console.log('🔍 MONITOR: Found transaction:', targetTransaction.transaction_id.hash)

    // Проверяем, что транзакция входящая
    if (targetTransaction.in_msg.source === null) {
      console.error('🔍 MONITOR: Transaction is not incoming')
      return false
    }

    // Проверяем получателя
    const expectedAddress = process.env.TON_WALLET_ADDRESS?.replace(/^0x/, '')
    const destinationAddress = targetTransaction.in_msg.destination?.replace(/^0x/, '')

    if (!expectedAddress || !destinationAddress || expectedAddress !== destinationAddress) {
      console.error('🔍 MONITOR: Wrong destination address')
      return false
    }

    // Проверяем memo
    if (targetTransaction.in_msg.message !== payment.memo) {
      console.error('🔍 MONITOR: Memo mismatch')
      return false
    }

    // Проверяем сумму
    const receivedAmount = parseInt(targetTransaction.in_msg.value || '0', 16) / 1e9
    const expectedAmount = parseFloat(payment.amount.toString())

    // Позволяем небольшую погрешность в 1%
    const tolerance = expectedAmount * 0.01
    if (Math.abs(receivedAmount - expectedAmount) > tolerance) {
      console.error('🔍 MONITOR: Amount mismatch')
      return false
    }

    console.log('✅ MONITOR: Transaction verified successfully')
    return true

  } catch (error) {
    console.error('🔍 MONITOR: Error checking transaction:', error)
    return false
  }
}

// Обрабатываем подтвержденный платеж
async function processConfirmedPayment(payment: any, txHash: string) {
  console.log('✅ MONITOR: Processing confirmed payment:', payment.paymentId)

  try {
    // Создание подписки
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + payment.product.periodDays)

    const subscription = await prisma.subscription.create({
      data: {
        userId: payment.userId,
        productId: payment.productId,
        channelId: payment.product.channelId,
        paymentId: payment.paymentId,
        status: 'active',
        startsAt: new Date(),
        expiresAt
      }
    })

    console.log('✅ MONITOR: Subscription created:', subscription.subscriptionId)

    // Обновление статуса платежа
    await prisma.payment.update({
      where: { paymentId: payment.paymentId },
      data: {
        status: 'success',
        txHash
      }
    })

    // Отправляем уведомление пользователю (можно добавить в будущем)
    console.log('✅ MONITOR: Payment processed successfully')

    return subscription

  } catch (error) {
    console.error('🔍 MONITOR: Error processing confirmed payment:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 MONITOR: Starting payment monitoring check')

    // Получаем все pending платежи
    const pendingPayments = await getPendingPayments()

    if (pendingPayments.length === 0) {
      console.log('🔍 MONITOR: No pending payments found')
      return NextResponse.json({
        success: true,
        message: 'No pending payments to check',
        checked: 0
      })
    }

    console.log(`🔍 MONITOR: Found ${pendingPayments.length} pending payments`)

    let processedCount = 0
    const results = []

    // Проверяем каждый платеж
    for (const payment of pendingPayments) {
      const isConfirmed = await checkPaymentTransaction(payment)

      if (isConfirmed) {
        // Получаем hash транзакции (в реальности нужно найти правильный hash)
        const txHash = `confirmed_${Date.now()}_${payment.paymentId}`

        // Обрабатываем подтвержденный платеж
        await processConfirmedPayment(payment, txHash)
        processedCount++

        results.push({
          paymentId: payment.paymentId,
          status: 'confirmed',
          txHash
        })
      } else {
        results.push({
          paymentId: payment.paymentId,
          status: 'pending'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Payment monitoring completed. Processed ${processedCount} payments.`,
      checked: pendingPayments.length,
      processed: processedCount,
      results
    })

  } catch (error) {
    console.error('🔍 MONITOR: Error in payment monitoring:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка мониторинга платежей' },
      { status: 500 }
    )
  }
}

// GET endpoint для проверки статуса
export async function GET(request: NextRequest) {
  try {
    const pendingPayments = await getPendingPayments()

    return NextResponse.json({
      success: true,
      pendingPayments: pendingPayments.length,
      payments: pendingPayments.map(p => ({
        paymentId: p.paymentId,
        amount: p.amount,
        currency: p.currency,
        memo: p.memo,
        createdAt: p.createdAt,
        productName: p.product?.name || 'Без названия'
      }))
    })
  } catch (error) {
    console.error('🔍 MONITOR: Error getting pending payments:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка получения списка платежей' },
      { status: 500 }
    )
  }
}