import { NextRequest, NextResponse } from 'next/server'

export async function POST() {
  try {
    const newWebhookUrl = 'https://tma-subscription.vercel.app/api/webhook'
    const botToken = process.env.BOT_TOKEN

    if (!botToken) {
      return NextResponse.json(
        { error: 'BOT_TOKEN not configured' },
        { status: 500 }
      )
    }

    console.log('🔧 Updating webhook to alias:', newWebhookUrl)

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: newWebhookUrl,
          drop_pending_updates: true
        }),
      }
    )

    const data = await response.json()

    if (data.ok) {
      console.log('✅ Webhook updated to alias successfully')

      // Отправляем уведомление
      try {
        await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: process.env.ADMIN_TELEGRAM_ID,
              text: `✅ *Webhook Updated*

🔗 *New URL*: ${newWebhookUrl}
📡 *Status*: Active
🎯 *Type*: Production Alias

Теперь все запросы будут автоматически идти на последний deployment через постоянный URL!`,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: '🚀 Открыть админ-панель',
                    web_app: {
                      url: 'https://tma-subscription.vercel.app/admin'
                    }
                  }
                ]]
              }
            }),
          }
        )
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError)
      }

      return NextResponse.json({
        success: true,
        webhookUrl: newWebhookUrl,
        message: 'Webhook updated to production alias successfully'
      })
    } else {
      console.error('❌ Webhook update failed:', data)
      return NextResponse.json(
        {
          error: 'Failed to update webhook',
          details: data
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Webhook update error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}