import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'

interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      first_name?: string
      last_name?: string
      username?: string
    }
    chat: {
      id: number
      type: string
      title?: string
      username?: string
    }
    text?: string
    date: number
  }
  callback_query?: {
    id: string
    from: {
      id: number
      first_name?: string
      username?: string
    }
    message?: {
      message_id: number
      chat: {
        id: number
        type: string
      }
    }
    data: string
  }
}

// Проверка вебхука от Telegram
function verifyWebhook(body: string, secret: string): boolean {
  const secretKey = crypto.createHash('sha256').update(secret).digest()
  const hmac = crypto.createHmac('sha256', secretKey).update(body).digest('hex')

  const signature = crypto.createHash('sha256').update(body).digest('hex')
  return hmac === signature
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const secret = process.env.BOT_SECRET

    // Проверка вебхука (если настроен секрет)
    if (secret && !verifyWebhook(body, secret)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }

    const update: TelegramUpdate = JSON.parse(body)
    const botToken = process.env.BOT_TOKEN!

    if (update.message) {
      await handleMessage(update.message, botToken)
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, botToken)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleMessage(message: any, botToken: string) {
  const { text, from, chat } = message
  const telegramId = BigInt(from.id)

  // Создание или обновление пользователя
  await prisma.user.upsert({
    where: { telegramId },
    update: {
      firstName: from.first_name,
      username: from.username
    },
    create: {
      telegramId,
      firstName: from.first_name,
      username: from.username
    }
  })

  // Обработка команд
  if (text === '/start') {
    await sendWelcomeMessage(chat.id, from.first_name, botToken)
  } else if (text === '/help') {
    await sendHelpMessage(chat.id, botToken)
  } else if (text === '/mysubscriptions') {
    await sendUserSubscriptions(chat.id, telegramId, botToken)
  } else {
    await sendDefaultMessage(chat.id, botToken)
  }
}

async function handleCallbackQuery(callbackQuery: any, botToken: string) {
  const { id, from, data, message } = callbackQuery
  const telegramId = BigInt(from.id)

  // Ответ на callback query (убираем часики на кнопке)
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: id,
      text: 'Загрузка...'
    })
  })

  // Обработка данных кнопки
  if (data === 'open_app') {
    await sendWelcomeMessage(message.chat.id, message.from.first_name, botToken)
  } else if (data.startsWith('manage_subscription_')) {
    const subscriptionId = data.replace('manage_subscription_', '')
    await manageSubscription(telegramId, subscriptionId, message.chat.id, botToken)
  }
}

async function sendWelcomeMessage(chatId: number, firstName?: string, botToken?: string) {
  if (!botToken) return

  const welcomeText = `
👋 *Добро пожаловать, ${firstName || 'Пользователь'}!*

Это бот для управления подписками на закрытые Telegram-каналы.

📱 *Что вы можете делать:*
• Просматривать доступные подписки
• Оформлять подписки через TON Connect
• Управлять своими активными подписками

🛍️ *Чтобы начать:*
Нажмите кнопку "Управление подписками" ниже, чтобы открыть Mini App

❓ *Нужна помощь?*
Используйте команду /help
  `.trim()

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: '🛍️ Управление подписками',
          web_app: {
            url: `${process.env.APP_URL}/app`
          }
        }
      ],
      [
        { text: '❓ Помощь', callback_data: 'help' }
      ]
    ]
  }

  await sendMessage(chatId, welcomeText, keyboard, botToken)
}

async function sendHelpMessage(chatId: number, botToken?: string) {
  if (!botToken) return

  const helpText = `
📖 *Справка по использованию бота*

🔹 *Доступные команды:*
• /start - Главное меню
• /help - Эта справка
• /mysubscriptions - Мои подписки

🔹 *Как оформить подписку:*
1. Нажмите "Управление подписками"
2. Выберите интересующий канал
3. Оплатите через TON Connect
4. Получите доступ к закрытому контенту

🔹 *Поддержка:*
Если у вас возникли проблемы, обратитесь к администратору.

💰 *Оплата:*
Мы принимаем USDT через TON блокчейн.
  `.trim()

  const keyboard = {
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

  await sendMessage(chatId, helpText, keyboard, botToken)
}

async function sendUserSubscriptions(chatId: number, telegramId: bigint, botToken?: string) {
  if (!botToken) return

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: telegramId,
        status: 'active',
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        product: {
          include: {
            channel: true
          }
        }
      }
    })

    if (subscriptions.length === 0) {
      const text = '📋 *У вас нет активных подписок*\n\nНажмите "Управление подписками", чтобы посмотреть доступные варианты.'

      const keyboard = {
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

      await sendMessage(chatId, text, keyboard, botToken)
      return
    }

    let text = '📋 *Ваши активные подписки:*\n\n'

    subscriptions.forEach((sub, index) => {
      const expiresAt = new Date(sub.expiresAt).toLocaleDateString('ru-RU')
      text += `${index + 1}. *${sub.product.name}*\n`
      text += `   📢 Канал: ${sub.product.channel.name}\n`
      text += `   📅 Истекает: ${expiresAt}\n\n`
    })

    const keyboard = {
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

    await sendMessage(chatId, text, keyboard, botToken)
  } catch (error) {
    console.error('Error sending user subscriptions:', error)
    await sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.', undefined, botToken)
  }
}

async function sendDefaultMessage(chatId: number, botToken?: string) {
  if (!botToken) return

  const text = '😕 Не понимаю вас. Используйте команду /help для справки или /start для главного меню.'

  const keyboard = {
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

  await sendMessage(chatId, text, keyboard, botToken)
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any, botToken?: string) {
  if (!botToken) return

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      })
    })
  } catch (error) {
    console.error('Error sending message:', error)
  }
}

async function manageSubscription(userId: bigint, subscriptionId: string, chatId: number, botToken: string) {
  // Здесь можно добавить логику управления подпиской через бота
  // Например, продление, отмена и т.д.
  await sendMessage(chatId, '🔧 Функция управления подпиской в разработке...', undefined, botToken)
}