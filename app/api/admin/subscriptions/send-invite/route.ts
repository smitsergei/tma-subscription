import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'
import { addUserToChannel } from '@/lib/botSync'

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
      console.error('🔍 SEND_INVITE API: Failed to create admin record:', createError)
      return false
    }
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 SEND_INVITE API: Starting request...')

    if (!(await checkAdminAuth(request))) {
      console.log('🔍 SEND_INVITE API: Authentication failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 SEND_INVITE API: Authentication successful')

    const { subscriptionId } = await request.json()

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'subscriptionId is required' },
        { status: 400 }
      )
    }

    // Получаем данные подписки с информацией о пользователе и канале
    const subscription = await prisma.subscription.findUnique({
      where: { subscriptionId },
      include: {
        user: true,
        product: {
          include: {
            channel: true
          }
        }
      }
    })

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 }
      )
    }

    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: 'Subscription is not active' },
        { status: 400 }
      )
    }

    if (!subscription.product?.channel) {
      return NextResponse.json(
        { error: 'Channel not found for this subscription' },
        { status: 404 }
      )
    }

    const botToken = process.env.BOT_TOKEN
    if (!botToken) {
      console.error('🔍 SEND_INVITE API: Bot token not configured')
      return NextResponse.json(
        { error: 'Bot token not configured' },
        { status: 500 }
      )
    }

    console.log('🔍 SEND_INVITE API: Sending invite link:', {
      userId: subscription.userId.toString(),
      channelId: subscription.product.channel.channelId.toString(),
      channelName: subscription.product.channel.name,
      userName: subscription.user.firstName
    })

    // Используем существующую функцию для добавления пользователя в канал
    console.log('🔍 SEND_INVITE API: Calling addUserToChannel...')
    const result = await addUserToChannel(
      subscription.userId.toString(),
      subscription.product.channel.channelId.toString(),
      botToken
    )

    console.log('🔍 SEND_INVITE API: addUserToChannel result:', result)

    if (result.success) {
      console.log('✅ SEND_INVITE API: Invite link process completed successfully')
      return NextResponse.json({
        success: true,
        message: 'Invite link sent successfully',
        inviteLink: result.inviteLink,
        details: {
          userName: subscription.user.firstName,
          channelName: subscription.product.channel.name,
          subscriptionStatus: subscription.status,
          telegramUserId: subscription.userId.toString()
        }
      })
    } else {
      console.error('❌ SEND_INVITE API: Failed to send invite link:', result.error)
      return NextResponse.json(
        {
          error: 'Failed to send invite link',
          details: result.error
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('🔍 SEND_INVITE API: Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}