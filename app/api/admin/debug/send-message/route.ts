import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const initData = request.headers.get('x-telegram-init-data')
  if (!initData) return false

  const urlParams = new URLSearchParams(initData)
  const userStr = urlParams.get('user')
  if (!userStr) return false

  const user = JSON.parse(decodeURIComponent(userStr))
  const telegramId = BigInt(user.id)

  // Для тестовых данных пропускаем валидацию хеша
  const isTestData = initData.includes('test_hash_for_development')
  if (!isTestData) {
    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) return false
  }

  const admin = await prisma.admin.findUnique({
    where: { telegramId }
  })

  if (!admin) {
    // Создаем админа если его нет (для тестовых данных)
    try {
      await prisma.user.upsert({
        where: { telegramId },
        update: {},
        create: {
          telegramId,
          firstName: user.first_name || 'Admin',
          username: user.username || 'admin',
        }
      })

      await prisma.admin.create({
        data: { telegramId }
      })

      return true
    } catch (createError) {
      console.error('🔍 DEBUG API: Failed to create admin record:', createError)
      return false
    }
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, message } = await request.json()

    if (!userId || !message) {
      return NextResponse.json(
        { error: 'userId and message are required' },
        { status: 400 }
      )
    }

    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      return NextResponse.json(
        { error: 'Bot token not configured' },
        { status: 500 }
      )
    }

    console.log('🔍 DEBUG API: Sending test message to user:', userId)

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: parseInt(userId),
          text: `🧪 Тестовое сообщение от админа:\n\n${message}`,
          parse_mode: 'HTML'
        })
      }
    )

    const data = await response.json()
    console.log('🔍 DEBUG API: Telegram response:', data)

    if (data.ok) {
      return NextResponse.json({
        success: true,
        message: 'Test message sent successfully',
        details: {
          messageId: data.result.message_id,
          userId: userId
        }
      })
    } else {
      return NextResponse.json(
        {
          error: 'Failed to send test message',
          details: data.description
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('🔍 DEBUG API: Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}