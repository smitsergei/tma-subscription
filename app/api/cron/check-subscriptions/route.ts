import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Проверка авторизации cron job (защита от несанкционированного запуска)
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('CRON_SECRET not set, skipping auth verification')
    return true
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  try {
    // Проверка авторизации
    if (!verifyCronAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('Starting subscription expiry check...')

    // Поиск истекших подписок
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        expiresAt: {
          lt: new Date()
        }
      },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            username: true
          }
        },
        channel: {
          select: {
            channelId: true,
            name: true,
            username: true
          }
        },
        product: {
          select: {
            name: true
          }
        }
      }
    })

    if (expiredSubscriptions.length === 0) {
      console.log('No expired subscriptions found')
      return NextResponse.json({
        success: true,
        message: 'No expired subscriptions found',
        processed: 0
      })
    }

    console.log(`Found ${expiredSubscriptions.length} expired subscriptions`)

    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      throw new Error('BOT_TOKEN not configured')
    }

    let processedCount = 0
    let errorCount = 0

    // Обработка каждой истекшей подписки
    for (const subscription of expiredSubscriptions) {
      try {
        // Обновление статуса подписки
        await prisma.subscription.update({
          where: {
            subscriptionId: subscription.subscriptionId
          },
          data: {
            status: 'expired'
          }
        })

        // Попытка удалить пользователя из канала
        await removeUserFromChannel(
          subscription.userId.toString(),
          subscription.channel.channelId.toString(),
          botToken
        )

        // Отправка уведомления пользователю
        await sendExpirationNotification(
          subscription.user.telegramId.toString(),
          subscription.product.name,
          subscription.channel.name,
          botToken
        )

        processedCount++
        console.log(`Processed subscription ${subscription.subscriptionId}`)

      } catch (error) {
        errorCount++
        console.error(`Error processing subscription ${subscription.subscriptionId}:`, error)
      }
    }

    console.log(`Subscription check completed. Processed: ${processedCount}, Errors: ${errorCount}`)

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} expired subscriptions`,
      data: {
        processed: processedCount,
        errors: errorCount,
        total: expiredSubscriptions.length
      }
    })
  } catch (error) {
    console.error('Error in subscription expiry check:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function removeUserFromChannel(userId: string, channelId: string, botToken: string): Promise<void> {
  try {
    // Проверка, состоит ли пользователь в канале
    const chatMemberResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          user_id: userId
        })
      }
    )

    const chatMemberData = await chatMemberResponse.json()

    if (chatMemberData.ok) {
      const status = chatMemberData.result.status

      // Если пользователь состоит в канале (не left/kicked), пытаемся его удалить
      if (status !== 'left' && status !== 'kicked') {
        // Для каналов нужно использовать ban/unban, так как прямого удаления нет
        // Сначала баним, потом разбаним (это удалит пользователя из канала)
        await fetch(
          `https://api.telegram.org/bot${botToken}/banChatMember`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channelId,
              user_id: userId,
              revoke_messages: false
            })
          }
        )

        // Сразу разбаниваем (чтобы пользователь мог снова войти при покупке подписки)
        await fetch(
          `https://api.telegram.org/bot${botToken}/unbanChatMember`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channelId,
              user_id: userId,
              only_if_banned: true
            })
          }
        )
      }
    }
  } catch (error) {
    console.error(`Error removing user ${userId} from channel ${channelId}:`, error)
    throw error
  }
}

async function sendExpirationNotification(
  userId: string,
  productName: string,
  channelName: string,
  botToken: string
): Promise<void> {
  try {
    const message = `
⏰ *Ваша подписка истекла*

📦 Продукт: ${productName}
📢 Канал: ${channelName}

Вы больше не имеете доступа к закрытому контенту.

🛍️ *Чтобы продлить подписку:*
1. Откройте бота
2. Нажмите "Управление подписками"
3. Выберите нужную подписку и оплатите

Спасибо за пользование нашим сервисом!
    `.trim()

    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: userId,
          text: message,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🛍️ Управление подписками',
                  web_app: {
                    url: `${process.env.APP_URL}/app`
                  }
                }
              ]
            ]
          }
        })
      }
    )
  } catch (error) {
    console.error(`Error sending expiration notification to user ${userId}:`, error)
    throw error
  }
}