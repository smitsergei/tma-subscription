import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const currentUrl = 'https://tma-subscription.vercel.app/admin'
    const botToken = process.env.BOT_TOKEN
    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID

    if (!botToken || !adminTelegramId) {
      return NextResponse.json(
        { error: 'Bot configuration missing' },
        { status: 500 }
      )
    }

    // Отключаем автоматическую отправку сообщений
    // Возвращаем только информацию о текущем URL
    console.log('📡 Admin link requested:', currentUrl);

    // Возвращаем успешный ответ без отправки сообщения
    return NextResponse.json({
      success: true,
      url: currentUrl,
      message: 'Admin link endpoint - notifications disabled'
    })
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