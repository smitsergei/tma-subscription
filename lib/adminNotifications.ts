import { prisma } from '@/lib/db'
import { telegramService } from './telegramService'

/**
 * Отправка уведомлений администраторам о различных событиях
 */

interface AdminNotificationData {
  type: 'new_subscription' | 'demo_access' | 'payment_attempt'
  userInfo: {
    telegramId: string
    firstName: string
    username?: string
  }
  productInfo: {
    name: string
    price?: number
    currency?: string
    periodDays?: number
    channelName: string
  }
  additionalInfo?: {
    paymentId?: string
    demoDays?: number
    expiresAt?: Date
    paymentMethod?: 'TON' | 'NOWPayments'
  }
}

/**
 * Получение всех администраторов из базы данных
 */
async function getAdmins(): Promise<{ telegramId: bigint }[]> {
  try {
    const admins = await prisma.admin.findMany({
      select: {
        telegramId: true
      }
    })

    return admins
  } catch (error) {
    console.error('❌ Error fetching admins:', error)
    return []
  }
}

/**
 * Формирование сообщения уведомления
 */
function formatNotificationMessage(data: AdminNotificationData): string {
  const { type, userInfo, productInfo, additionalInfo } = data

  const userLink = userInfo.username
    ? `[@${userInfo.username}](https://t.me/${userInfo.username})`
    : `${userInfo.firstName} (${userInfo.telegramId})`

  let message = ''

  switch (type) {
    case 'new_subscription':
      message = `🎉 *НОВАЯ ПОДПИСКА*

👤 *Пользователь:* ${userLink}
📦 *Продукт:* ${productInfo.name}
💰 *Цена:* ${productInfo.price} ${productInfo.currency || 'USD'}
⏰ *Период:* ${productInfo.periodDays} дней
📢 *Канал:* ${productInfo.channelName}
🆔 *Payment ID:* ${additionalInfo?.paymentId || 'N/A'}
💳 *Способ оплаты:* ${additionalInfo?.paymentMethod || 'N/A'}

✅ Подписка успешно активирована!`
      break

    case 'demo_access':
      message = `🚀 *НОВЫЙ ДЕМО-ДОСТУП*

👤 *Пользователь:* ${userLink}
📦 *Продукт:* ${productInfo.name}
📅 *Демо-период:* ${additionalInfo?.demoDays || productInfo.periodDays} дней
📢 *Канал:* ${productInfo.channelName}

🔍 Пользователь получил демо-доступ к каналу`
      break

    case 'payment_attempt':
      message = `💳 *ПОПЫТКА ОПЛАТЫ*

👤 *Пользователь:* ${userLink}
📦 *Продукт:* ${productInfo.name}
💰 *Сумма:* ${productInfo.price} ${productInfo.currency || 'USD'}
📢 *Канал:* ${productInfo.channelName}
🆔 *Payment ID:* ${additionalInfo?.paymentId}
💳 *Способ оплаты:* ${additionalInfo?.paymentMethod}

⏳ Ожидание подтверждения платежа...`
      break
  }

  // Добавляем временную метку
  const timestamp = new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow'
  })

  message += `\n\n🕐 *Время:* ${timestamp}`

  return message
}

/**
 * Отправка уведомления всем администраторам
 */
export async function notifyAdmins(notificationData: AdminNotificationData): Promise<void> {
  try {
    console.log(`📨 Sending admin notification: ${notificationData.type}`, {
      user: notificationData.userInfo.firstName,
      product: notificationData.productInfo.name
    })

    const admins = await getAdmins()

    if (admins.length === 0) {
      console.warn('⚠️ No admins found to notify')
      return
    }

    const message = formatNotificationMessage(notificationData)

    // Отправляем сообщение всем администраторам
    const notifications = admins.map(async (admin) => {
      try {
        const response = await telegramService.sendMessage({
          chat_id: admin.telegramId.toString(),
          text: message,
          parse_mode: 'Markdown'
        })

        if (response.ok) {
          console.log(`✅ Admin notification sent to: ${admin.telegramId}`)
        } else {
          console.error(`❌ Failed to send admin notification to ${admin.telegramId}:`, response.description)
        }
      } catch (error) {
        console.error(`❌ Error sending admin notification to ${admin.telegramId}:`, error)
      }
    })

    // Ждем завершения всех отправок
    await Promise.allSettled(notifications)

    console.log(`📨 Admin notifications completed: ${notificationData.type}`)

  } catch (error) {
    console.error('❌ Error in notifyAdmins:', error)
  }
}

/**
 * Уведомление о новой подписке
 */
export async function notifyAdminsAboutNewSubscription(
  userInfo: { telegramId: string; firstName: string; username?: string },
  productInfo: { name: string; price: number; currency?: string; periodDays: number; channelName: string },
  additionalInfo: { paymentId: string; expiresAt?: Date; paymentMethod?: 'TON' | 'NOWPayments' }
): Promise<void> {
  await notifyAdmins({
    type: 'new_subscription',
    userInfo,
    productInfo,
    additionalInfo
  })
}

/**
 * Уведомление о демо-доступе
 */
export async function notifyAdminsAboutDemoAccess(
  userInfo: { telegramId: string; firstName: string; username?: string },
  productInfo: { name: string; periodDays: number; channelName: string },
  additionalInfo: { demoDays: number }
): Promise<void> {
  await notifyAdmins({
    type: 'demo_access',
    userInfo,
    productInfo,
    additionalInfo
  })
}

/**
 * Уведомление о попытке оплаты
 */
export async function notifyAdminsAboutPaymentAttempt(
  userInfo: { telegramId: string; firstName: string; username?: string },
  productInfo: { name: string; price: number; currency?: string; periodDays: number; channelName: string },
  additionalInfo: { paymentId: string; paymentMethod?: 'TON' | 'NOWPayments' }
): Promise<void> {
  await notifyAdmins({
    type: 'payment_attempt',
    userInfo,
    productInfo,
    additionalInfo
  })
}