import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

interface VerifyUSDTPaymentRequest {
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

    const body: VerifyUSDTPaymentRequest = await request.json()
    const { paymentId } = body

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'ID платежа обязателен' },
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

    // Для USDT используем поллинг - ищем транзакцию по memo
    console.log('🔍 USDT VERIFY: Starting USDT transaction polling for payment:', paymentId)

    const isUSDTransactionReceived = await pollForUSDTTransaction(payment)

    if (!isUSDTransactionReceived) {
      return NextResponse.json(
        {
          success: false,
          error: 'Платеж еще не получен. Пожалуйста, подождите несколько минут и попробуйте снова.',
          needsRetry: true
        },
        { status: 202 } // Accepted
      )
    }

    // Обработка подтвержденного платежа
    const subscription = await processConfirmedPayment(payment, 'usdt-jetton')

    return NextResponse.json({
      success: true,
      data: {
        subscriptionId: subscription.subscriptionId,
        expiresAt: subscription.expiresAt,
        channelName: payment.product.channel.name
      },
      message: 'Оплата прошла успешно! Подписка активирована.'
    })

  } catch (error) {
    console.error('Error verifying USDT payment:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка верификации платежа' },
      { status: 500 }
    )
  }
}

async function pollForUSDTTransaction(payment: any): Promise<boolean> {
  try {
    console.log('🔍 USDT VERIFY: Polling for USDT transaction with memo:', payment.memo)

    if (!process.env.TONCENTER_API_KEY) {
      console.error('🔍 USDT VERIFY: TONCENTER_API_KEY not configured')
      return false
    }

    // Проверяем транзакции на нашем кошельке
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
      console.error('🔍 USDT VERIFY: Failed to fetch transactions from Toncenter')
      return false
    }

    const data = await response.json()

    if (!data.ok || !data.result) {
      console.error('🔍 USDT VERIFY: Invalid response from Toncenter')
      return false
    }

    // Ищем транзакцию, которая содержит наш memo
    // Для USDT jetton transfers memo будет в payload транзакции
    for (const tx of data.result) {
      console.log('🔍 USDT VERIFY: Checking transaction:', tx.transaction_id?.hash)

      // Проверяем все исходящие сообщения в транзакции
      const messages = tx.out_msgs || []

      for (const msg of messages) {
        if (msg.destination === process.env.TON_WALLET_ADDRESS) {
          // Ищем memo в payload или message
          let foundMemo = msg.message || ''

          // Если memo не найден в message, ищем в payload
          if (!foundMemo && msg.msg_data?.body) {
            try {
              const payloadBase64 = msg.msg_data.body
              if (typeof payloadBase64 === 'string') {
                const buffer = Buffer.from(payloadBase64, 'base64')
                foundMemo = buffer.toString('utf8').replace(/[^\x20-\x7E]/g, '')
              }
            } catch (error) {
              console.log('🔍 USDT VERIFY: Could not decode payload')
            }
          }

          if (foundMemo === payment.memo) {
            console.log('✅ USDT VERIFY: Found transaction with matching memo!')
            console.log('Transaction hash:', tx.transaction_id?.hash)
            return true
          }
        }
      }
    }

    console.log('🔍 USDT VERIFY: No matching transaction found')
    return false

  } catch (error) {
    console.error('🔍 USDT VERIFY: Error polling for USDT transaction:', error)
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
    console.log('🔍 USDT VERIFY: Checking user status in channel:', data.result?.status)

    if (!data.ok || !data.result) {
      console.log('🔍 USDT VERIFY: Failed to get chat member status')
      return
    }

    const userStatus = data.result.status

    // Если пользователя нет в канале или он покинул его
    if (['left', 'kicked', 'restricted'].includes(userStatus)) {
      console.log('🔍 USDT VERIFY: User not in channel, attempting to add')

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
        console.log('🔍 USDT VERIFY: Created invite link:', inviteData.result.invite_link)

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
        console.error('🔍 USDT VERIFY: Failed to create invite link:', inviteData)
      }
    } else {
      console.log('🔍 USDT VERIFY: User already in channel')
    }

  } catch (error) {
    console.error('🔍 USDT VERIFY: Error managing channel membership:', error)
    throw error
  }
}

async function processConfirmedPayment(payment: any, txHash: string): Promise<any> {
  console.log('✅ USDT VERIFY: Processing confirmed payment:', payment.paymentId)

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

  console.log('✅ USDT VERIFY: Subscription created:', subscription.subscriptionId)

  // Добавление пользователя в Telegram канал
  try {
    await addUserToChannel(
      payment.userId.toString(),
      payment.product.channel.channelId.toString(),
      process.env.BOT_TOKEN!
    )
    console.log('✅ USDT VERIFY: User added to channel successfully')
  } catch (error) {
    console.error('🔍 USDT VERIFY: Error adding user to channel:', error)
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
    console.log('✅ USDT VERIFY: Notification sent successfully')
  } catch (error) {
    console.error('🔍 USDT VERIFY: Error sending notification:', error)
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
      console.error('🔍 USDT VERIFY: Failed to send notification:', errorText)
    }

  } catch (error) {
    console.error('🔍 USDT VERIFY: Error sending payment notification:', error)
  }
}