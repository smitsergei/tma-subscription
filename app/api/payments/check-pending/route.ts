import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 CRON: Starting pending payments check...')

    // Получаем все pending платежи старше 1 минуты
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: 'pending',
        createdAt: {
          lt: fiveMinutesAgo
        }
      },
      include: {
        user: true,
        product: {
          include: { channel: true }
        }
      }
    })

    console.log(`🔍 CRON: Found ${pendingPayments.length} pending payments to check`)

    let processedCount = 0
    let failedCount = 0

    for (const payment of pendingPayments) {
      try {
        // Проверяем последние транзакции для кошелька
        const isVerified = await verifyTonTransaction('polling', payment)

        if (isVerified) {
          processedCount++
          console.log(`✅ CRON: Payment ${payment.paymentId} verified and processed`)
        } else {
          // Проверяем, не прошло ли 30 минут с создания платежа
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
          if (payment.createdAt < thirtyMinutesAgo) {
            // Отмечаем платеж как failed если прошло > 30 минут
            await prisma.payment.update({
              where: { paymentId: payment.paymentId },
              data: { status: 'failed' }
            })
            failedCount++
            console.log(`❌ CRON: Payment ${payment.paymentId} marked as failed (timeout)`)
          }
        }
      } catch (error) {
        console.error(`🔍 CRON: Error checking payment ${payment.paymentId}:`, error)
      }
    }

    console.log(`🔍 CRON: Check completed. Processed: ${processedCount}, Failed: ${failedCount}`)

    return NextResponse.json({
      success: true,
      message: 'Pending payments check completed',
      data: {
        checked: pendingPayments.length,
        processed: processedCount,
        failed: failedCount
      }
    })

  } catch (error) {
    console.error('🔍 CRON: Error in pending payments check:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function verifyTonTransaction(txHash: string, payment: any): Promise<boolean> {
  try {
    console.log('🔍 CRON: Starting transaction verification for payment:', payment.paymentId)
    console.log('🔍 CRON: Payment details:', {
      paymentId: payment.paymentId,
      amount: payment.amount,
      currency: payment.currency,
      memo: payment.memo
    })

    if (!process.env.TONCENTER_API_KEY) {
      console.error('🔍 CRON: TONCENTER_API_KEY not configured')
      return false
    }

    // Получение информации о транзакции через Toncenter API
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
      console.error('🔍 CRON: Failed to fetch transactions from Toncenter')
      return false
    }

    const data = await response.json()

    if (!data.ok || !data.result) {
      console.error('🔍 CRON: Invalid response from Toncenter')
      return false
    }

    // Поиск нужной транзакции
    const targetTransaction = data.result.find((tx: any) => {
      // Проверяем memo в сообщении
      const message = tx.in_msg?.message || ''
      return message === payment.memo
    })

    if (!targetTransaction) {
      console.log('🔍 CRON: Transaction not found for memo:', payment.memo)
      return false
    }

    console.log('🔍 CRON: Found transaction:', targetTransaction.transaction_id.hash)

    // Проверяем, что транзакция входящая
    if (targetTransaction.in_msg.source === null) {
      console.error('🔍 CRON: Transaction is not incoming')
      return false
    }

    // Проверяем получателя
    const expectedAddress = process.env.TON_WALLET_ADDRESS?.replace(/^0x/, '')
    const destinationAddress = targetTransaction.in_msg.destination?.replace(/^0x/, '')

    if (!expectedAddress || !destinationAddress || expectedAddress !== destinationAddress) {
      console.error('🔍 CRON: Wrong destination address')
      console.log('Expected:', expectedAddress)
      console.log('Got:', destinationAddress)
      return false
    }

    // Проверяем memo
    if (targetTransaction.in_msg.message !== payment.memo) {
      console.error('🔍 CRON: Memo mismatch')
      console.log('Expected:', payment.memo)
      console.log('Got:', targetTransaction.in_msg.message)
      return false
    }

    // Проверяем сумму
    const receivedAmount = parseInt(targetTransaction.in_msg.value || '0', 16) / 1e9
    const expectedAmount = parseFloat(payment.amount.toString())

    // Позволяем небольшую погрешность в 1%
    const tolerance = expectedAmount * 0.01
    if (Math.abs(receivedAmount - expectedAmount) > tolerance) {
      console.error('🔍 CRON: Amount mismatch')
      console.log('Expected:', expectedAmount)
      console.log('Got:', receivedAmount)
      return false
    }

    console.log('✅ CRON: Transaction verified successfully')
    return true

  } catch (error) {
    console.error('🔍 CRON: Error verifying TON transaction:', error)
    return false
  }
}

async function processConfirmedPayment(payment: any, txHash: string): Promise<void> {
  console.log('✅ CRON: Processing confirmed payment:', payment.paymentId)

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

  console.log('✅ CRON: Subscription created:', subscription.subscriptionId)

  // Добавление пользователя в Telegram канал
  try {
    await addUserToChannel(
      payment.userId.toString(),
      payment.product.channel.channelId.toString(),
      process.env.BOT_TOKEN!
    )
    console.log('✅ CRON: User added to channel successfully')
  } catch (error) {
    console.error('🔍 CRON: Error adding user to channel:', error)
    // Не прерываем процесс, если не удалось добавить в канал
  }

  // Обновление статуса платежа
  await prisma.payment.update({
    where: { paymentId: payment.paymentId },
    data: {
      status: 'success',
      txHash
    }
  })

  // Отправляем уведомление пользователю
  try {
    await sendPaymentNotification(
      payment.userId.toString(),
      payment.product.name,
      payment.product.channel.name,
      expiresAt
    )
    console.log('✅ CRON: Notification sent successfully')
  } catch (error) {
    console.error('🔍 CRON: Error sending notification:', error)
  }
}

async function addUserToChannel(userId: string, channelId: string, botToken: string): Promise<void> {
  try {
    // Проверяем текущий статус пользователя в канале
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: channelId,
          user_id: userId
        })
      }
    )

    const data = await response.json()
    console.log('🔍 CRON: Checking user status in channel:', data.result?.status)

    if (!data.ok || !data.result) {
      console.log('🔍 CRON: Failed to get chat member status')
      return
    }

    const userStatus = data.result.status

    // Если пользователя нет в канале или он покинул его
    if (['left', 'kicked', 'restricted'].includes(userStatus)) {
      console.log('🔍 CRON: User not in channel, attempting to add')

      // Создаем приглашение для пользователя
      const inviteResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: channelId,
            name: 'Приглашение после оплаты подписки',
            creates_join_request: false,
            member_limit: 1,
            expire_date: Math.floor(Date.now() / 1000) + 86400 // 24 часа
          })
        }
      )

      const inviteData = await inviteResponse.json()

      if (inviteData.ok && inviteData.result?.invite_link) {
        console.log('🔍 CRON: Created invite link:', inviteData.result.invite_link)

        // Отправляем ссылку-приглашение пользователю
        await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: userId,
              text: `🎉 Ваша подписка активирована!

Чтобы получить доступ к каналу, перейдите по ссылке:
${inviteData.result.invite_link}

Ссылка действительна 24 часа.`,
              disable_web_page_preview: false
            })
          }
        )
      } else {
        console.error('🔍 CRON: Failed to create invite link:', inviteData)
      }
    } else {
      console.log('🔍 CRON: User already in channel')
    }

  } catch (error) {
    console.error('🔍 CRON: Error managing channel membership:', error)
    throw error
  }
}

async function sendPaymentNotification(
  userId: string,
  productName: string,
  channelName: string,
  expiresAt: Date
): Promise<void> {
  try {
    const message = `✅ <b>Оплата прошла успешно!</b>

📦 <b>Подписка:</b> ${productName}
📢 <b>Канал:</b> ${channelName}
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
          chat_id: userId,
          text: message,
          parse_mode: 'HTML'
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('🔍 CRON: Failed to send notification:', errorText)
    }

  } catch (error) {
    console.error('🔍 CRON: Error sending payment notification:', error)
  }
}

// Для поддержки cron job запросов
export async function POST(request: NextRequest) {
  return GET(request)
}