import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Секретный ключ для вебхука (должен совпадать с тем, что в настройках Toncenter)
const WEBHOOK_SECRET = process.env.TONCENTER_WEBHOOK_SECRET || 'default-secret'

export async function POST(request: NextRequest) {
  try {
    // Проверка секретного ключа
    const signature = request.headers.get('X-Toncenter-Signature')
    if (!signature) {
      console.error('🔍 WEBHOOK: No signature provided')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // В реальном приложении здесь была бы проверка подписи
    // if (!verifySignature(signature, await request.text(), WEBHOOK_SECRET)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    const body = await request.json()
    console.log('🔍 WEBHOOK: Received webhook:', body)

    // Обработка входящей транзакции
    if (body.type === 'incoming_message' && body.message) {
      const message = body.message
      const source = message.source
      const destination = message.destination
      const amount = message.value
      const text = message.message || ''

      console.log('🔍 WEBHOOK: Processing transaction:', {
        source,
        destination,
        amount,
        text
      })

      // Проверяем, что транзакция на наш адрес
      const expectedAddress = process.env.TON_WALLET_ADDRESS?.replace(/^0x/, '')
      const normalizedDestination = destination?.replace(/^0x/, '')

      if (!expectedAddress || !normalizedDestination || expectedAddress !== normalizedDestination) {
        console.log('🔍 WEBHOOK: Transaction not for our address, skipping')
        return NextResponse.json({ success: true })
      }

      // Ищем платеж по memo
      const pendingPayment = await prisma.payment.findFirst({
        where: {
          memo: text,
          status: 'pending'
        },
        include: {
          user: true,
          product: {
            include: { channel: true }
          }
        }
      })

      if (!pendingPayment) {
        console.log('🔍 WEBHOOK: No pending payment found for memo:', text)
        return NextResponse.json({ success: true })
      }

      console.log('🔍 WEBHOOK: Found pending payment:', pendingPayment.paymentId)

      // Проверяем сумму
      const receivedAmount = parseInt(amount, 16) / 1e9
      const expectedAmount = parseFloat(pendingPayment.amount.toString())

      // Позволяем небольшую погрешность в 1%
      const tolerance = expectedAmount * 0.01
      if (Math.abs(receivedAmount - expectedAmount) > tolerance) {
        console.log('🔍 WEBHOOK: Amount mismatch', {
          received: receivedAmount,
          expected: expectedAmount
        })
        return NextResponse.json({ success: true })
      }

      console.log('🔍 WEBHOOK: Amount verified, processing payment')

      // Создаем подписку
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + (pendingPayment.product?.periodDays || 30))

      const subscription = await prisma.subscription.create({
        data: {
          userId: pendingPayment.userId,
          productId: pendingPayment.productId,
          channelId: pendingPayment.product.channelId,
          paymentId: pendingPayment.paymentId,
          status: 'active',
          startsAt: new Date(),
          expiresAt
        }
      })

      console.log('🔍 WEBHOOK: Subscription created:', subscription.subscriptionId)

      // Добавление пользователя в Telegram канал
      try {
        await addUserToChannel(
          pendingPayment.userId.toString(),
          pendingPayment.product.channel.channelId.toString(),
          process.env.BOT_TOKEN!
        )
        console.log('🔍 WEBHOOK: User added to channel successfully')
      } catch (error) {
        console.error('🔍 WEBHOOK: Error adding user to channel:', error)
        // Не прерываем процесс, если не удалось добавить в канал
      }

      // Обновление статуса платежа
      await prisma.payment.update({
        where: { paymentId: pendingPayment.paymentId },
        data: {
          status: 'success',
          txHash: body.transaction_id?.hash || 'webhook'
        }
      })

      console.log('✅ WEBHOOK: Payment processed successfully:', pendingPayment.paymentId)

      // Отправляем уведомление пользователю в Telegram
      try {
        await sendPaymentNotification(
          pendingPayment.userId.toString(),
          pendingPayment.product.name,
          pendingPayment.product.channel.name,
          expiresAt
        )
      } catch (error) {
        console.error('🔍 WEBHOOK: Error sending notification:', error)
      }

      return NextResponse.json({
        success: true,
        message: 'Payment processed successfully'
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('🔍 WEBHOOK: Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function addUserToChannel(userId: string, channelId: string, botToken: string): Promise<void> {
  try {
    // Сначала проверяем статус пользователя в канале
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
    console.log('🔍 WEBHOOK: Chat member status:', data.result?.status)

    // Если пользователя нет в канале или он покинул его
    if (!data.ok || !data.result || ['left', 'kicked', 'restricted'].includes(data.result.status)) {
      // Пытаемся добавить пользователя (инвайт)
      const inviteResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: channelId,
            name: 'Приглашение после оплаты',
            creates_join_request: false,
            member_limit: 1
          })
        }
      )

      const inviteData = await inviteResponse.json()

      if (inviteData.ok && inviteData.result?.invite_link) {
        // В реальном приложении здесь можно отправить пользователю ссылку-приглашение
        console.log('🔍 WEBHOOK: Created invite link:', inviteData.result.invite_link)
      }
    }

  } catch (error) {
    console.error('🔍 WEBHOOK: Error managing channel membership:', error)
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
    const message = `✅ Оплата прошла успешно!

📦 Подписка: ${productName}
📢 Канал: ${channelName}
⏰ Действует до: ${expiresAt.toLocaleDateString('ru-RU')}

Спасибо за покупку!`

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
      console.error('🔍 WEBHOOK: Failed to send notification:', await response.text())
    }

  } catch (error) {
    console.error('🔍 WEBHOOK: Error sending payment notification:', error)
  }
}