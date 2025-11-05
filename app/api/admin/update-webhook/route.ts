import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { botToken } = await request.json()

    if (!botToken) {
      return NextResponse.json(
        { error: 'BOT_TOKEN is required' },
        { status: 400 }
      )
    }

    const webhookUrl = 'https://tma-subscription.vercel.app/api/webhook'

    // Обновляем webhook
    const webhookResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query']
        }),
      }
    )

    const webhookResult = await webhookResponse.json()

    if (!webhookResult.ok) {
      return NextResponse.json(
        { error: `Failed to set webhook: ${webhookResult.description}` },
        { status: 400 }
      )
    }

    // Проверяем статус webhook
    const statusResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getWebhookInfo`
    )

    const statusResult = await statusResponse.json()

    return NextResponse.json({
      success: true,
      webhook: webhookResult,
      status: statusResult,
      message: `Webhook успешно установлен на ${webhookUrl}`
    })

  } catch (error) {
    console.error('Webhook update error:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}