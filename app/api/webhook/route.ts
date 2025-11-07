import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Получаем тело запроса
    const body = await request.text()

    // Парсим JSON
    let update
    try {
      update = JSON.parse(body)
    } catch (error) {
      console.error('❌ Failed to parse webhook body:', error)
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Проверяем, что это запрос от Telegram
    const telegramToken = process.env.BOT_TOKEN
    if (!telegramToken) {
      return NextResponse.json(
        { error: 'BOT_TOKEN not configured' },
        { status: 500 }
      )
    }

    // Логируем запрос для отладки
    console.log('📨 Telegram webhook received:', {
      timestamp: new Date().toISOString(),
      updateId: update.update_id,
      chatId: update.message?.chat?.id || update.callback_query?.from?.id,
      bodyPreview: body.substring(0, 200) + (body.length > 200 ? '...' : '')
    })

    // Обрабатываем различные типы обновлений
    let responseSent = false

    // Обработка обычных сообщений
    if (update.message) {
      const message = update.message
      const chatId = message.chat.id
      const text = message.text || ''
      const from = message.from

      console.log('💬 Processing message:', { chatId, text })

      // Создание или обновление пользователя
      await prisma.user.upsert({
        where: { telegramId: BigInt(from.id) },
        update: {
          firstName: from.first_name,
          username: from.username
        },
        create: {
          telegramId: BigInt(from.id),
          firstName: from.first_name,
          username: from.username
        }
      })

      if (text === '/start') {
        await sendMessage(
          chatId,
          '<b>👋 Добро пожаловать в TMA-Подписка!</b>\n\n' +
          'Здесь вы можете приобрести подписку на наши эксклюзивные каналы.\n\n' +
          '<b>📱 Откройте Mini App, чтобы начать:</b>\n' +
          'Нажмите кнопку ниже, чтобы открыть приложение и выбрать подходящую подписку.',
          {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '🚀 Открыть Mini App',
                  web_app: {
                    url: process.env.APP_URL?.replace(/\n/g, '') + '/app'
                  }
                }
              ]]
            }
          }
        )
        responseSent = true
      }

      if (text === '/test') {
        await sendMessage(
          chatId,
          '🔧 Открываю тестовую страницу для диагностики...',
          {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '🔧 Открыть тестовую страницу',
                  web_app: {
                    url: process.env.APP_URL?.replace(/\n/g, '') + '/test'
                  }
                }
              ]]
            }
          }
        )
        responseSent = true
      }

      if (text === '/admin') {
        // Проверяем, является ли пользователь администратором
        const adminTelegramId = process.env.ADMIN_TELEGRAM_ID

        console.log('🔐 Admin check:', {
          chatId: chatId,
          chatIdType: typeof chatId,
          adminId: adminTelegramId,
          adminIdType: typeof adminTelegramId,
          comparison: chatId.toString() === adminTelegramId
        })

        if (!adminTelegramId) {
          console.log('❌ Admin not configured')
          await sendMessage(chatId, '❌ Администратор не настроен')
          responseSent = true
          return
        }

        if (chatId.toString() !== adminTelegramId && chatId !== parseInt(adminTelegramId)) {
          console.log('❌ Access denied for user:', chatId)
          await sendMessage(chatId, `❌ Доступ запрещен. Ваш ID: ${chatId}, ID администратора: ${adminTelegramId}`)
          responseSent = true
          return
        }

        await sendMessage(
          chatId,
          '👑 Панель администратора\n\n' +
          'Доступные функции:\n' +
          '📊 Статистика продаж\n' +
          '📝 Управление продуктами\n' +
          '👥 Управление подписками\n\n' +
          'Откройте админ-панель:',
          {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '👑 Открыть админ-панель',
                  web_app: {
                    url: process.env.APP_URL?.replace(/\n/g, '') + '/admin'
                  }
                }
              ]]
            }
          }
        )
        responseSent = true
      }

      if (text === '/help') {
        await sendMessage(
          chatId,
          '<b>📖 Справка по использованию бота</b>\n\n' +
          '<b>🔹 Доступные команды:</b>\n' +
          '• /start - Главное меню\n' +
          '• /help - Эта справка\n' +
          '• /mysubscriptions - Мои подписки\n\n' +
          '<b>🔹 Как оформить подписку:</b>\n' +
          '1. Нажмите "🚀 Открыть Mini App"\n' +
          '2. Выберите интересующий канал\n' +
          '3. Оплатите через доступную платежную систему\n' +
          '4. Получите доступ к закрытому контенту\n\n' +
          '<b>🔹 Поддержка:</b>\n' +
          'Если у вас возникли проблемы, обратитесь к администратору.',
          {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '🚀 Открыть Mini App',
                  web_app: {
                    url: process.env.APP_URL?.replace(/\n/g, '') + '/app'
                  }
                }
              ]]
            }
          }
        )
        responseSent = true
      }

      if (text === '/mysubscriptions') {
        try {
          const subscriptions = await prisma.subscription.findMany({
            where: {
              userId: BigInt(from.id),
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
            await sendMessage(
              chatId,
              '<b>📋 У вас нет активных подписок</b>\n\n' +
              'Нажмите "🚀 Открыть Mini App", чтобы посмотреть доступные варианты.',
              {
                reply_markup: {
                  inline_keyboard: [[
                    {
                      text: '🚀 Открыть Mini App',
                      web_app: {
                        url: process.env.APP_URL?.replace(/\n/g, '') + '/app'
                      }
                    }
                  ]]
                }
              }
            )
            responseSent = true
          }

          let text = '<b>📋 Ваши активные подписки:</b>\n\n'

          subscriptions.forEach((sub, index) => {
            const expiresAt = new Date(sub.expiresAt).toLocaleDateString('ru-RU')
            text += `<b>${index + 1}. ${sub.product.name}</b>\n`
            text += `   📢 Канал: ${sub.product.channel.name}\n`
            text += `   📅 Истекает: ${expiresAt}\n\n`
          })

          await sendMessage(
            chatId,
            text,
            {
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: '🚀 Открыть Mini App',
                    web_app: {
                      url: process.env.APP_URL?.replace(/\n/g, '') + '/app'
                    }
                  }
                ]]
              }
            }
          )
        } catch (error) {
          console.error('Error sending user subscriptions:', error)
          await sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.')
        }
        responseSent = true
      }

      // Обработка других сообщений
      if (!responseSent) {
        await sendMessage(
          chatId,
          '😕 Не понимаю вас. Используйте команду /help для справки или /start для главного меню.',
          {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '🚀 Открыть Mini App',
                  web_app: {
                    url: process.env.APP_URL?.replace(/\n/g, '') + '/app'
                  }
                }
              ]]
            }
          }
        )
        responseSent = true
      }
    }

    // Обработка callback запросов от кнопок
    if (update.callback_query) {
      const callbackQuery = update.callback_query
      const chatId = callbackQuery.message?.chat?.id || callbackQuery.from?.id
      const data = callbackQuery.data

      console.log('🔘 Processing callback:', { chatId, data })

      if (data === 'open_app') {
        await answerCallbackQuery(callbackQuery.id)
        await sendMessage(
          chatId,
          '📱 Открываю Mini App для вас...',
          {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '🚀 Открыть Mini App',
                  web_app: {
                    url: process.env.APP_URL?.replace(/\n/g, '') + '/app'
                  }
                }
              ]]
            }
          }
        )
        responseSent = true
      }
    }

    // Если ответ отправлен, возвращаем успешный статус
    if (responseSent) {
      return NextResponse.json({ ok: true })
    }

    // Для других запросов просто возвращаем успешный статус
    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Вспомогательные функции для работы с Telegram Bot API
async function sendMessage(chatId: number, text: string, options?: any) {
  try {
    const telegramToken = process.env.BOT_TOKEN
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`

    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      ...options
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Failed to send message:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      })
    } else {
      console.log('✅ Message sent successfully to chat:', chatId)
    }

    return response
  } catch (error) {
    console.error('❌ Error sending message:', error)
    throw error
  }
}

async function answerCallbackQuery(callbackQueryId: string) {
  try {
    const telegramToken = process.env.BOT_TOKEN
    const url = `https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        callback_query_id: callbackQueryId
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Failed to answer callback query:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      })
    }

    return response
  } catch (error) {
    console.error('❌ Error answering callback query:', error)
    throw error
  }
}

// Обработка GET запросов для проверки статуса
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    botToken: !!process.env.BOT_TOKEN,
    appUrl: process.env.APP_URL
  })
}