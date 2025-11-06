import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const currentUrl = 'https://tma-subscription-nn1ll37q6-smits-projects-3d9ec8f0.vercel.app/admin'
    const botToken = process.env.BOT_TOKEN
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID

    if (!botToken || !adminTelegramId) {
      return NextResponse.json(
        { error: 'Bot configuration missing' },
        { status: 500 }
      )
    }

    // Отправляем новое сообщение с правильной ссылкой
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: adminTelegramId,
          text: `🔗 *Новая ссылка на админ-панель*

Используйте эту ссылку для входа в админ-панель со всеми последними обновлениями:

${currentUrl}

⚠️ Старые ссылки могут работать некорректно`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              {
                text: '🚀 Открыть админ-панель',
                web_app: {
                  url: currentUrl
                }
              }
            ]]
          }
        }),
      }
    )

    const data = await response.json()

    if (data.ok) {
      return NextResponse.json({
        success: true,
        url: currentUrl,
        message: 'Admin link sent to Telegram'
      })
    } else {
      return NextResponse.json(
        {
          error: 'Failed to send message',
          details: data
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error sending admin link:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}