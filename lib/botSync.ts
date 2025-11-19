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

    // Проверяем статус пользователя в канале
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: channelId,
          user_id: parseInt(userId)
        })
      }
    )

    const data = await response.json()
    console.log('🤖 BOT SYNC: Chat member status:', data.result?.status)

    // Если пользователь уже в канале, отправляем уведомление
    if (data.ok && data.result && ['member', 'administrator', 'creator'].includes(data.result.status)) {
      console.log('🤖 BOT SYNC: User already in channel, sending notification...')

      try {
        // Получаем информацию о канале для уведомления
        const channelResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getChat`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: channelId
            })
          }
        )

        const channelData = await channelResponse.json()
        const channelName = channelData.ok ? channelData.result.title : 'Канал'

        const message = `🎉 Ваш доступ к каналу подтвержден!

📢 Канал: ${channelName}
✅ Вы уже являетесь участником канала

Если у вас нет доступа к каналу, попробуйте:
1. Перезапустить Telegram
2. Нажать на название канала в списке
3. Обновить список каналов`

        const messageResponse = await fetch(
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

        const messageData = await messageResponse.json()

        if (messageData.ok) {
          console.log('✅ BOT SYNC: Access confirmation sent to user:', userId)
          return { success: true }
        } else {
          console.error('❌ BOT SYNC: Failed to send access confirmation:', messageData)
          // Если не удалось отправить сообщение, все равно считаем успехом (пользователь в канале)
          return { success: true } as { success: boolean; warning?: string }
        }
      } catch (error) {
        console.error('❌ BOT SYNC: Error sending access confirmation:', error)
        // Если не удалось отправить сообщение, все равно считаем успехом (пользователь в канале)
        return { success: true } as { success: boolean; warning?: string }
      }
    }

    // Если пользователя нет в канале, создаем приглашение
    if (!data.ok || !data.result || ['left', 'kicked', 'restricted'].includes(data.result.status)) {
      console.log('🤖 BOT SYNC: User not in channel, creating invite link...')

      // Сначала пробуем получить существующие invite-ссылки
      try {
        const existingInvitesResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getChatInviteLinks`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: channelId
            })
          }
        )

        const existingInvitesData = await existingInvitesResponse.json()

        // Ищем рабочую ссылку с нашим именем
        if (existingInvitesData.ok && existingInvitesData.result) {
          const existingInvite = existingInvitesData.result.find((invite: any) =>
            invite.name === 'Приглашение для подписки' &&
            invite.member_limit === 1 &&
            !invite.is_revoked
          )

          if (existingInvite) {
            console.log('🤖 BOT SYNC: Found existing invite link:', existingInvite.invite_link)

            try {
              await sendInviteLink(userId, existingInvite.invite_link, channelId, botToken)
              console.log('✅ BOT SYNC: Existing invite link sent successfully')
              return {
                success: true,
                inviteLink: existingInvite.invite_link
              }
            } catch (sendError) {
              console.error('❌ BOT SYNC: Failed to send existing invite link:', sendError)
              return {
                success: false,
                error: `Failed to send existing invite: ${sendError instanceof Error ? sendError.message : 'Unknown error'}`
              }
            }
          }
        }
      } catch (error) {
        console.log('🤖 BOT SYNC: Could not check existing invites, creating new one:', error)
      }

      // Если нет существующей ссылки, создаем новую
      console.log('🤖 BOT SYNC: Creating new invite link...')
      const inviteResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: channelId,
            name: `Приглашение для подписки`,
            creates_join_request: false,
            member_limit: 1
            // Убрали expire_date, чтобы ссылка не истекала
          })
        }
      )

      const inviteData = await inviteResponse.json()

      if (inviteData.ok && inviteData.result?.invite_link) {
        console.log('🤖 BOT SYNC: Created new invite link:', inviteData.result.invite_link)

        // Отправляем ссылку-приглашение пользователю
        try {
          await sendInviteLink(userId, inviteData.result.invite_link, channelId, botToken)
          console.log('✅ BOT SYNC: New invite link sent successfully')
          return {
            success: true,
            inviteLink: inviteData.result.invite_link
          }
        } catch (sendError) {
          console.error('❌ BOT SYNC: Failed to send new invite link:', sendError)
          return {
            success: false,
            error: `New invite link created but failed to send: ${sendError instanceof Error ? sendError.message : 'Unknown error'}`
          }
        }
      } else {
        console.error('🤖 BOT SYNC: Failed to create new invite link:', inviteData)
        return { success: false, error: 'Failed to create new invite link' }
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

    // Пытаемся забанить пользователя (это удалит его из канала)
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/banChatMember`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: channelId,
          user_id: parseInt(userId),
          revoke_messages: false // Не удалять сообщения пользователя
        })
      }
    )

    const data = await response.json()

    if (data.ok) {
      console.log('🤖 BOT SYNC: User banned from channel successfully')

      // Сразу разбаниваем пользователя, чтобы он мог вернуться позже с новой подпиской
      await unbanUserFromChannel(userId, channelId, botToken)

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
    await fetch(
      `https://api.telegram.org/bot${botToken}/unbanChatMember`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: channelId,
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
    console.log('🤖 BOT SYNC: Starting to send invite link to user:', userId, 'for channel:', channelId)

    // Получаем информацию о канале
    console.log('🤖 BOT SYNC: Getting channel info...')
    const channelResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: channelId
        })
      }
    )

    const channelData = await channelResponse.json()
    console.log('🤖 BOT SYNC: Channel response:', { ok: channelData.ok, error: channelData.description })

    if (!channelData.ok) {
      console.error('🤖 BOT SYNC: Failed to get channel info:', channelData)
      throw new Error(`Failed to get channel info: ${channelData.description}`)
    }

    const channelName = channelData.result?.title || 'Канал'
    console.log('🤖 BOT SYNC: Channel name:', channelName)

    const message = `🎉 Доступ к каналу открыт!

📢 Канал: ${channelName}
🔗 Ваша ссылка для входа: ${inviteLink}

Ссылка действительна 24 часа. Добро пожаловать!`

    console.log('🤖 BOT SYNC: Sending message to user:', userId)
    const messageResponse = await fetch(
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

    const messageData = await messageResponse.json()
    console.log('🤖 BOT SYNC: Message response:', { ok: messageData.ok, error: messageData.description })

    if (messageData.ok) {
      console.log('✅ BOT SYNC: Invite link successfully sent to user:', userId)
    } else {
      console.error('❌ BOT SYNC: Failed to send invite link to user:', userId, 'Error:', messageData)
      throw new Error(`Failed to send message: ${messageData.description}`)
    }

  } catch (error) {
    console.error('❌ BOT SYNC: Error sending invite link to user:', userId, error)
    throw error // Пробрасываем ошибку наверх для обработки
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
): Promise<{ success: boolean; error?: string; inviteLink?: string }> {
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

      return {
        success: result.success,
        error: result.error,
        inviteLink: result.inviteLink
      }
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