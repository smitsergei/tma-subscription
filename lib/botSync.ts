import { prisma } from '@/lib/db'

/**
 * Управление доступом пользователей к Telegram каналам
 * Используется для синхронизации между админ-панелью и ботом
 */

/**
 * Добавление пользователя в Telegram канал
 */
export async function addUserToChannel(
  userId: string,
  channelId: string,
  botToken: string
): Promise<{ success: boolean; error?: string; inviteLink?: string }> {
  try {
    console.log('🤖 BOT SYNC: Adding user to channel:', { userId, channelId })

    // Очищаем channelId - убираем @ если он уже есть, затем добавляем правильно
    const cleanChannelId = channelId.toString().startsWith('@')
      ? channelId.toString()
      : `@${channelId}`;

    console.log('🤖 BOT SYNC: Using cleaned channel ID:', cleanChannelId);

    // Проверяем статус пользователя в канале
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: cleanChannelId,
          user_id: parseInt(userId)
        })
      }
    )

    const data = await response.json()
    console.log('🤖 BOT SYNC: Chat member status:', data.result?.status)

    // Если пользователь уже в канале
    if (data.ok && data.result && ['member', 'administrator', 'creator'].includes(data.result.status)) {
      console.log('🤖 BOT SYNC: User already in channel')
      return { success: true }
    }

    // Если пользователя нет в канале, создаем приглашение
    if (!data.ok || !data.result || ['left', 'kicked', 'restricted'].includes(data.result.status)) {
      const inviteResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: cleanChannelId,
            name: `Приглашение для доступа #${userId}`,
            creates_join_request: false,
            member_limit: 1,
            expire_date: Math.floor(Date.now() / 1000) + 24 * 60 * 60 // Ссылка действует 24 часа
          })
        }
      )

      const inviteData = await inviteResponse.json()

      if (inviteData.ok && inviteData.result?.invite_link) {
        console.log('🤖 BOT SYNC: Created invite link:', inviteData.result.invite_link)

        // Отправляем ссылку-приглашение пользователю
        await sendInviteLink(userId, inviteData.result.invite_link, cleanChannelId, botToken)

        return {
          success: true,
          inviteLink: inviteData.result.invite_link
        }
      } else {
        console.error('🤖 BOT SYNC: Failed to create invite link:', inviteData)
        return { success: false, error: 'Failed to create invite link' }
      }
    }

    return { success: true }

  } catch (error) {
    console.error('🤖 BOT SYNC: Error adding user to channel:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Удаление пользователя из Telegram канала
 */
export async function removeUserFromChannel(
  userId: string,
  channelId: string,
  botToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🤖 BOT SYNC: Removing user from channel:', { userId, channelId })

    // Очищаем channelId - убираем @ если он уже есть, затем добавляем правильно
    const cleanChannelId = channelId.toString().startsWith('@')
      ? channelId.toString()
      : `@${channelId}`;

    console.log('🤖 BOT SYNC: Using cleaned channel ID for removal:', cleanChannelId);

    // Пытаемся забанить пользователя (это удалит его из канала)
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/banChatMember`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: cleanChannelId,
          user_id: parseInt(userId),
          revoke_messages: false // Не удалять сообщения пользователя
        })
      }
    )

    const data = await response.json()

    if (data.ok) {
      console.log('🤖 BOT SYNC: User banned from channel successfully')

      // Сразу разбаниваем пользователя, чтобы он мог вернуться позже с новой подпиской
      await unbanUserFromChannel(userId, cleanChannelId, botToken)

      return { success: true }
    } else {
      console.error('🤖 BOT SYNC: Failed to ban user:', data)
      return { success: false, error: 'Failed to remove user from channel' }
    }

  } catch (error) {
    console.error('🤖 BOT SYNC: Error removing user from channel:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Разбан пользователя в канале
 */
async function unbanUserFromChannel(
  userId: string,
  channelId: string,
  botToken: string
): Promise<void> {
  try {
    // Очищаем channelId для корректного формата
    const cleanChannelId = channelId.toString().startsWith('@')
      ? channelId.toString()
      : `@${channelId}`;

    console.log('🤖 BOT SYNC: Unbanning user from channel:', cleanChannelId);

    await fetch(
      `https://api.telegram.org/bot${botToken}/unbanChatMember`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: cleanChannelId,
          user_id: parseInt(userId),
          only_if_banned: true
        })
      }
    )
    console.log('🤖 BOT SYNC: User unbanned successfully')
  } catch (error) {
    console.error('🤖 BOT SYNC: Error unbanning user:', error)
  }
}

/**
 * Отправка ссылки-приглашения пользователю
 */
async function sendInviteLink(
  userId: string,
  inviteLink: string,
  channelId: string,
  botToken: string
): Promise<void> {
  try {
    // Очищаем channelId для корректного формата
    const cleanChannelId = channelId.toString().startsWith('@')
      ? channelId.toString()
      : `@${channelId}`;

    console.log('🤖 BOT SYNC: Getting channel info for:', cleanChannelId);

    // Получаем информацию о канале
    const channelResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: cleanChannelId
        })
      }
    )

    const channelData = await channelResponse.json()
    const channelName = channelData.ok ? channelData.result.title : 'Канал'

    const message = `🎉 Доступ к каналу открыт!

📢 Канал: ${channelName}
🔗 Ваша ссылка для входа: ${inviteLink}

Ссылка действительна 24 часа. Добро пожаловать!`

    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: parseInt(userId),
          text: message,
          parse_mode: 'HTML'
        })
      }
    )

    console.log('🤖 BOT SYNC: Invite link sent to user:', userId)

  } catch (error) {
    console.error('🤖 BOT SYNC: Error sending invite link:', error)
  }
}

/**
 * Отправка уведомления об изменении подписки
 */
export async function sendSubscriptionNotification(
  userId: string,
  productName: string,
  channelName: string,
  action: 'created' | 'updated' | 'deleted' | 'expired',
  expiresAt?: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      return { success: false, error: 'Bot token not configured' }
    }

    let message = ''

    switch (action) {
      case 'created':
        message = `✅ Вам была оформлена подписка!

📦 Подписка: ${productName}
📢 Канал: ${channelName}
⏰ Действует до: ${expiresAt?.toLocaleDateString('ru-RU') || 'Не указано'}

Доступ к каналу будет открыт в ближайшее время.`
        break

      case 'updated':
        message = `📝 Ваша подписка была изменена!

📦 Подписка: ${productName}
📢 Канал: ${channelName}
⏰ Действует до: ${expiresAt?.toLocaleDateString('ru-RU') || 'Не указано'}

Статус доступа к каналу обновлен.`
        break

      case 'deleted':
        message = `❌ Ваша подписка была удалена

📦 Подписка: ${productName}
📢 Канал: ${channelName}

Доступ к каналу прекращен. Для возобновления доступа оформите новую подписку.`
        break

      case 'expired':
        message = `⏰ Срок действия вашей подписки истек

📦 Подписка: ${productName}
📢 Канал: ${channelName}

Доступ к каналу прекращен. Для продления подпики оформите новую подписку.`
        break
    }

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: parseInt(userId),
          text: message,
          parse_mode: 'HTML'
        })
      }
    )

    if (response.ok) {
      console.log(`🤖 BOT SYNC: ${action} notification sent to user:`, userId)
      return { success: true }
    } else {
      console.error('🤖 BOT SYNC: Failed to send notification:', await response.text())
      return { success: false, error: 'Failed to send notification' }
    }

  } catch (error) {
    console.error('🤖 BOT SYNC: Error sending subscription notification:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Синхронизация доступа к каналу при изменении подписки
 */
export async function syncChannelAccess(
  userId: string,
  channelId: string,
  subscriptionStatus: string,
  productName: string,
  channelName: string,
  expiresAt?: Date
): Promise<{ success: boolean; error?: string }> {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    console.error('🤖 BOT SYNC: Bot token not configured')
    return { success: false, error: 'Bot token not configured' }
  }

  try {
    console.log('🤖 BOT SYNC: Syncing channel access:', {
      userId,
      channelId,
      status: subscriptionStatus
    })

    if (subscriptionStatus === 'active') {
      // Добавляем пользователя в канал
      const result = await addUserToChannel(userId, channelId, botToken)

      if (result.success) {
        // Отправляем уведомление о создании подписки
        await sendSubscriptionNotification(userId, productName, channelName, 'created', expiresAt)
      }

      return result
    } else {
      // Удаляем пользователя из канала (expired, cancelled)
      const result = await removeUserFromChannel(userId, channelId, botToken)

      if (result.success) {
        // Отправляем уведомление об изменении/удалении подписки
        const action = subscriptionStatus === 'expired' ? 'expired' : 'deleted'
        await sendSubscriptionNotification(userId, productName, channelName, action, expiresAt)
      }

      return result
    }

  } catch (error) {
    console.error('🤖 BOT SYNC: Error syncing channel access:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}