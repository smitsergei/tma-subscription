import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'
import { Address, beginCell, toNano } from '@ton/ton'
import { TonClient } from '@ton/ton'

export const dynamic = 'force-dynamic'

interface VerifyPaymentRequest {
  txHash: string
  paymentId: string
}

function getInitData(request: NextRequest): string | null {
  const initData = request.headers.get('x-telegram-init-data')
  if (initData) return initData

  const { searchParams } = new URL(request.url)
  return searchParams.get('initData')
}

export async function POST(request: NextRequest) {
  try {
    const initData = getInitData(request)
    if (!initData) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация Telegram' },
        { status: 401 }
      )
    }

    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return NextResponse.json(
        { success: false, error: 'Неверные данные авторизации' },
        { status: 401 }
      )
    }

    const body: VerifyPaymentRequest = await request.json()
    const { txHash, paymentId } = body

    if (!txHash || !paymentId) {
      return NextResponse.json(
        { success: false, error: 'Хеш транзакции и ID платежа обязательны' },
        { status: 400 }
      )
    }

    // Получение пользователя из initData
    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')
    if (!userStr) {
      return NextResponse.json(
        { success: false, error: 'Не удалось получить данные пользователя' },
        { status: 400 }
      )
    }

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    // Поиск платежа
    const payment = await prisma.payment.findUnique({
      where: { paymentId },
      include: {
        user: true,
        product: {
          include: { channel: true }
        }
      }
    })

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Платеж не найден' },
        { status: 404 }
      )
    }

    if (payment.userId !== telegramId) {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    if (payment.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Платеж уже обработан' },
        { status: 400 }
      )
    }

    // Верификация транзакции через TON API
    const isValidTransaction = await verifyTonTransaction(txHash, payment)

    if (!isValidTransaction) {
      // Обновляем статус платежа как failed
      await prisma.payment.update({
        where: { paymentId },
        data: {
          status: 'failed',
          txHash
        }
      })

      return NextResponse.json(
        { success: false, error: 'Транзакция не найдена или неверная' },
        { status: 400 }
      )
    }

    // Обработка подтвержденного платежа
    const subscription = await processConfirmedPayment(payment, txHash)

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: subscription.subscriptionId,
        expiresAt: subscription.expiresAt,
        channelName: payment.product?.channel?.name || 'Без названия'
      },
      message: 'Оплата прошла успешно! Подписка активирована.'
    })
  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка верификации платежа' },
      { status: 500 }
    )
  }
}

async function verifyTonTransaction(txHash: string, payment: any): Promise<boolean> {
  try {
    console.log('🔍 VERIFY: Starting transaction verification for txHash:', txHash)
    console.log('🔍 VERIFY: Payment details:', {
      paymentId: payment.paymentId,
      amount: payment.amount,
      currency: payment.currency,
      memo: payment.memo
    })

    if (!process.env.TONCENTER_API_KEY) {
      console.error('🔍 VERIFY: TONCENTER_API_KEY not configured')
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
      console.error('🔍 VERIFY: Failed to fetch transactions from Toncenter')
      return false
    }

    const data = await response.json()

    if (!data.ok || !data.result) {
      console.error('🔍 VERIFY: Invalid response from Toncenter')
      return false
    }

    // Поиск нужной транзакции
    const targetTransaction = data.result.find((tx: any) => {
      // Для поллинга ищем по memo вместо hash
      if (txHash === 'polling') {
        // Проверяем memo в сообщении
        const message = tx.in_msg?.message || ''
        return message === payment.memo
      }

      // Для обычной проверки по hash
      const transactionHash = tx.transaction_id?.hash
      if (!transactionHash) return false

      // Нормализуем hash для сравнения (убираем 0x префикс если есть)
      const normalizedTxHash = transactionHash.toLowerCase().replace(/^0x/, '')
      const normalizedTargetHash = txHash.toLowerCase().replace(/^0x/, '')

      return normalizedTxHash === normalizedTargetHash
    })

    if (!targetTransaction) {
      console.error('🔍 VERIFY: Transaction not found in recent transactions')
      return false
    }

    console.log('🔍 VERIFY: Found transaction:', targetTransaction.transaction_id.hash)

    // Проверяем, что транзакция входящая
    if (targetTransaction.in_msg.source === null) {
      console.error('🔍 VERIFY: Transaction is not incoming')
      return false
    }

    // Проверяем получателя
    const expectedAddress = process.env.TON_WALLET_ADDRESS?.replace(/^0x/, '')
    const destinationAddress = targetTransaction.in_msg.destination?.replace(/^0x/, '')

    if (!expectedAddress || !destinationAddress || expectedAddress !== destinationAddress) {
      console.error('🔍 VERIFY: Wrong destination address')
      console.log('Expected:', expectedAddress)
      console.log('Got:', destinationAddress)
      return false
    }

    // Проверяем memo (comment в транзакции)
    // TON транзакции могут хранить memo в поле message или в payload
    const transactionMessage = targetTransaction.in_msg?.message || ''

    // Если memo в прямом сообщении не найден, пробуем извлечь из payload
    let extractedMemo = transactionMessage
    if (!extractedMemo && targetTransaction.in_msg?.msg_data?.body) {
      try {
        // Пробуем декодировать payload для извлечения memo
        const payloadBase64 = targetTransaction.in_msg.msg_data.body
        if (typeof payloadBase64 === 'string') {
          // Декодируем base64 и ищем текст
          const buffer = Buffer.from(payloadBase64, 'base64')
          extractedMemo = buffer.toString('utf8').replace(/[^\x20-\x7E]/g, '') // Удаляем non-ASCII символы
        }
      } catch (error) {
        console.log('🔍 VERIFY: Could not decode payload for memo extraction')
      }
    }

    if (extractedMemo !== payment.memo) {
      console.error('🔍 VERIFY: Memo mismatch')
      console.log('Expected:', payment.memo)
      console.log('Got:', extractedMemo)
      console.log('Original message:', transactionMessage)
      return false
    }

    // Проверяем сумму
    // Для USDT конвертируем сумму из nanoTON
    const receivedAmount = parseInt(targetTransaction.in_msg.value || '0', 16) / 1e9
    const expectedAmount = parseFloat(payment.amount.toString())

    // Позволяем небольшую погрешность в 1%
    const tolerance = expectedAmount * 0.01
    if (Math.abs(receivedAmount - expectedAmount) > tolerance) {
      console.error('🔍 VERIFY: Amount mismatch')
      console.log('Expected:', expectedAmount)
      console.log('Got:', receivedAmount)
      return false
    }

    console.log('✅ VERIFY: Transaction verified successfully')
    return true

  } catch (error) {
    console.error('🔍 VERIFY: Error verifying TON transaction:', error)
    return false
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
    console.log('🔍 VERIFY: Checking user status in channel:', data.result?.status)

    if (!data.ok || !data.result) {
      console.log('🔍 VERIFY: Failed to get chat member status')
      return
    }

    const userStatus = data.result.status

    // Если пользователя нет в канале или он покинул его
    if (['left', 'kicked', 'restricted'].includes(userStatus)) {
      console.log('🔍 VERIFY: User not in channel, attempting to add')

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
        console.log('🔍 VERIFY: Created invite link:', inviteData.result.invite_link)

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
        console.error('🔍 VERIFY: Failed to create invite link:', inviteData)
      }
    } else {
      console.log('🔍 VERIFY: User already in channel')
    }

  } catch (error) {
    console.error('🔍 VERIFY: Error managing channel membership:', error)
    throw error
  }
}

async function processConfirmedPayment(payment: any, txHash: string): Promise<any> {
  console.log('✅ VERIFY: Processing confirmed payment:', payment.paymentId)

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

  console.log('✅ VERIFY: Subscription created:', subscription.subscriptionId)

  // Добавление пользователя в Telegram канал
  try {
    await addUserToChannel(
      payment.userId.toString(),
      payment.product.channel.channelId.toString(),
      process.env.BOT_TOKEN!
    )
    console.log('✅ VERIFY: User added to channel successfully')
  } catch (error) {
    console.error('🔍 VERIFY: Error adding user to channel:', error)
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
    console.log('✅ VERIFY: Notification sent successfully')
  } catch (error) {
    console.error('🔍 VERIFY: Error sending notification:', error)
  }

  return subscription
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
      console.error('🔍 VERIFY: Failed to send notification:', errorText)
    }

  } catch (error) {
    console.error('🔍 VERIFY: Error sending payment notification:', error)
  }
}