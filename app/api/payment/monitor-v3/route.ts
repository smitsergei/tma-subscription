import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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

// Проверяем через API v3 pendingActions
async function checkPendingActions() {
  try {
    console.log('🔍 MONITOR V3: Checking pending actions...')

    if (!process.env.TONCENTER_API_KEY) {
      console.error('🔍 MONITOR V3: TONCENTER_API_KEY not configured')
      return []
    }

    const response = await fetch('https://toncenter.com/api/v3/pendingActions', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TONCENTER_API_KEY
      }
    })

    if (!response.ok) {
      console.error('🔍 MONITOR V3: Failed to fetch pending actions')
      return []
    }

    const data = await response.json()
    console.log('📄 MONITOR V3: Pending actions response:', data)

    return data.pending_actions || []

  } catch (error) {
    console.error('🔍 MONITOR V3: Error checking pending actions:', error)
    return []
  }
}

// Проверяем транзакции через API v3
async function checkTransactionsV3(address: string, limit: number = 50) {
  try {
    console.log('🔍 MONITOR V3: Checking transactions for address:', address)

    if (!process.env.TONCENTER_API_KEY) {
      console.error('🔍 MONITOR V3: TONCENTER_API_KEY not configured')
      return []
    }

    const response = await fetch(`https://toncenter.com/api/v3/transactions?account=${address}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.TONCENTER_API_KEY
      }
    })

    if (!response.ok) {
      console.error('🔍 MONITOR V3: Failed to fetch transactions')
      return []
    }

    const data = await response.json()
    console.log('📄 MONITOR V3: Transactions response length:', data.transactions?.length || 0)

    return data.transactions || []

  } catch (error) {
    console.error('🔍 MONITOR V3: Error checking transactions:', error)
    return []
  }
}

// Проверяем конкретный платеж через API v3
async function checkPaymentTransactionV3(payment: any): Promise<{ found: boolean; txHash?: string }> {
  try {
    console.log('🔍 MONITOR V3: Checking payment:', payment.paymentId)

    const walletAddress = process.env.TON_WALLET_ADDRESS
    if (!walletAddress) {
      console.error('🔍 MONITOR V3: TON_WALLET_ADDRESS not configured')
      return { found: false }
    }

    // Сначала проверяем pending actions
    const pendingActions = await checkPendingActions()

    // Ищем в pending actions
    const matchingPendingAction = pendingActions.find((action: any) => {
      // Проверяем различные поля где может быть memo
      const message = action.message || action.comment || action.description || ''
      return message === payment.memo
    })

    if (matchingPendingAction) {
      console.log('🔍 MONITOR V3: Found matching pending action')
      return { found: false } // Еще в обработке
    }

    // Проверяем последние транзакции
    const transactions = await checkTransactionsV3(walletAddress, 100)

    // Ищем транзакцию с нужным memo
    const targetTransaction = transactions.find((tx: any) => {
      // Проверяем разные поля где может быть memo в API v3
      const message = tx.in_msg?.message ||
                     tx.in_msg?.comment ||
                     tx.description ||
                     tx.extra ||
                     ''

      return message === payment.memo
    })

    if (!targetTransaction) {
      console.log('🔍 MONITOR V3: Transaction not found for payment:', payment.paymentId)
      return { found: false }
    }

    console.log('🔍 MONITOR V3: Found transaction:', targetTransaction.hash)

    // Проверяем, что транзакция входящая
    if (!targetTransaction.in_msg || !targetTransaction.in_msg.source) {
      console.error('🔍 MONITOR V3: Transaction is not incoming')
      return { found: false }
    }

    // Проверяем получателя
    const destination = targetTransaction.in_msg.destination
    if (!destination || destination !== walletAddress) {
      console.error('🔍 MONITOR V3: Wrong destination address')
      console.log('Expected:', walletAddress)
      console.log('Got:', destination)
      return { found: false }
    }

    // Проверяем сумму
    const receivedAmount = parseFloat(targetTransaction.in_msg.value || '0')
    const expectedAmount = parseFloat(payment.amount.toString())

    // Для USDT в TON нужно учитывать конвертацию
    // Позволяем небольшую погрешность в 5%
    const tolerance = expectedAmount * 0.05
    if (Math.abs(receivedAmount - expectedAmount * 1e9) > tolerance * 1e9) {
      console.error('🔍 MONITOR V3: Amount mismatch')
      console.log('Expected:', expectedAmount * 1e9)
      console.log('Got:', receivedAmount)
      return { found: false }
    }

    console.log('✅ MONITOR V3: Transaction verified successfully')
    return { found: true, txHash: targetTransaction.hash }

  } catch (error) {
    console.error('🔍 MONITOR V3: Error checking transaction:', error)
    return { found: false }
  }
}

// Обрабатываем подтвержденный платеж
async function processConfirmedPayment(payment: any, txHash: string) {
  console.log('✅ MONITOR V3: Processing confirmed payment:', payment.paymentId)

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

    console.log('✅ MONITOR V3: Subscription created:', subscription.subscriptionId)

    // Обновление статуса платежа
    await prisma.payment.update({
      where: { paymentId: payment.paymentId },
      data: {
        status: 'success',
        txHash
      }
    })

    // Отправляем уведомление пользователю через Telegram Bot API
    try {
      const message = `✅ <b>Оплата прошла успешно!</b>

📦 <b>Подписка:</b> ${payment.product.name}
📢 <b>Канал:</b> ${payment.product.channel.name}
⏰ <b>Действует до:</b> ${expiresAt.toLocaleDateString('ru-RU')}

Спасибо за покупку! Приятного пользования!`

      const response = await fetch(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: payment.userId.toString(),
            text: message,
            parse_mode: 'HTML'
          })
        }
      )

      if (response.ok) {
        console.log('✅ MONITOR V3: Notification sent successfully')
      } else {
        console.error('🔍 MONITOR V3: Failed to send notification')
      }
    } catch (notifyError) {
      console.error('🔍 MONITOR V3: Error sending notification:', notifyError)
    }

    return subscription

  } catch (error) {
    console.error('🔍 MONITOR V3: Error processing confirmed payment:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 MONITOR V3: Starting payment monitoring check')

    // Получаем все pending платежи
    const pendingPayments = await getPendingPayments()

    if (pendingPayments.length === 0) {
      console.log('🔍 MONITOR V3: No pending payments found')
      return NextResponse.json({
        success: true,
        message: 'No pending payments to check',
        checked: 0,
        processed: 0
      })
    }

    console.log(`🔍 MONITOR V3: Found ${pendingPayments.length} pending payments`)

    let processedCount = 0
    const results = []

    // Проверяем каждый платеж
    for (const payment of pendingPayments) {
      const result = await checkPaymentTransactionV3(payment)

      if (result.found && result.txHash) {
        // Обрабатываем подтвержденный платеж
        await processConfirmedPayment(payment, result.txHash)
        processedCount++

        results.push({
          paymentId: payment.paymentId,
          status: 'confirmed',
          txHash: result.txHash
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
    console.error('🔍 MONITOR V3: Error in payment monitoring:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка мониторинга платежей' },
      { status: 500 }
    )
  }
}

// GET endpoint для проверки статуса и получения pending actions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const checkActions = searchParams.get('checkActions') === 'true'

    if (checkActions) {
      // Проверяем pending actions
      const pendingActions = await checkPendingActions()

      return NextResponse.json({
        success: true,
        pendingActions: pendingActions.length,
        actions: pendingActions
      })
    } else {
      // Получаем статус pending платежей
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
          productName: p.product.name
        }))
      })
    }
  } catch (error) {
    console.error('🔍 MONITOR V3: Error in GET request:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка получения данных' },
      { status: 500 }
    )
  }
}