import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Проверим текущий webhook
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN || '7507378625:AAHYFqfuONHKFWQJ4ic3LWb1m7zrE5mQ5Ws'}/getWebhookInfo`
    )
    const data = await response.json()

    return NextResponse.json({
      status: 'Webhook debug info',
      webhook: data,
      envBotToken: !!process.env.BOT_TOKEN,
      currentUrl: 'https://tma-subscription.vercel.app/api/webhook',
      timestamp: new Date().toISOString(),
      instructions: `
Чтобы обновить webhook, используй:
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \\
     -H "Content-Type: application/json" \\
     -d '{"url": "https://tma-subscription.vercel.app/api/webhook", "allowed_updates": ["message", "callback_query"]}'
      `
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}