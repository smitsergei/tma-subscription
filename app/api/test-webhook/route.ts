import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    botToken: !!process.env.BOT_TOKEN,
    appUrl: process.env.APP_URL,
    webhookCode: `
// Код для установки webhook:
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \\
     -H "Content-Type: application/json" \\
     -d '{"url": "https://tma-subscription.vercel.app/api/webhook", "allowed_updates": ["message", "callback_query"]}'
    `
  })
}