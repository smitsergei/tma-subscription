import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Full bot messages debugging...')

    // Проверяем переменные окружения
    const envVars = {
      BOT_TOKEN: process.env.BOT_TOKEN ? `***${process.env.BOT_TOKEN.slice(-4)}` : 'NOT_SET',
      BOT_TOKEN_LENGTH: process.env.BOT_TOKEN?.length || 0,
      APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'NOT_SET',
      ADMIN_TELEGRAM_ID: process.env.ADMIN_TELEGRAM_ID || 'NOT_SET'
    }

    // Тестируем базовую работу бота
    let botStatus = null
    try {
      if (process.env.BOT_TOKEN) {
        const botInfoResponse = await fetch(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getMe`
        )
        const botInfo = await botInfoResponse.json()
        botStatus = {
          success: botInfo.ok,
          result: botInfo.ok ? {
            id: botInfo.result.id,
            username: botInfo.result.username,
            first_name: botInfo.result.first_name
          } : null,
          error: !botInfo.ok ? botInfo.description : null
        }
      }
    } catch (error) {
      botStatus = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Проверяем последние демо-доступы
    const recentDemoAccesses = await prisma.demoAccess.findMany({
      take: 3,
      orderBy: { startedAt: 'desc' },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            username: true
          }
        },
        product: {
          select: {
            productId: true,
            name: true,
            channel: {
              select: {
                channelId: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Проверяем последние подписки (созданные админом)
    const recentSubscriptions = await prisma.subscription.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            username: true
          }
        },
        product: {
          select: {
            productId: true,
            name: true,
            channel: {
              select: {
                channelId: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Проверяем информацию о каналах
    const channels = await prisma.channel.findMany({
      include: {
        _count: {
          select: {
            products: true
          }
        }
      }
    })

    // Тестируем отправку тестового сообщения админу
    let testMessageResult = null
    if (process.env.BOT_TOKEN && process.env.ADMIN_TELEGRAM_ID) {
      try {
        const testResponse = await fetch(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: process.env.ADMIN_TELEGRAM_ID,
              text: `🧪 *Тестовое сообщение от системы*

Время: ${new Date().toLocaleString('ru-RU')}
Статус: Diagnostics running

Это тестовое сообщение для проверки работоспособности бота.`,
              parse_mode: 'Markdown'
            })
          }
        )
        const testResult = await testResponse.json()
        testMessageResult = {
          success: testResult.ok,
          message_id: testResult.ok ? testResult.result.message_id : null,
          error: !testResult.ok ? testResult.description : null
        }
      } catch (error) {
        testMessageResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // Тестируем создание invite link для первого доступного канала
    let inviteLinkTest = null
    if (process.env.BOT_TOKEN && channels.length > 0) {
      try {
        const firstChannel = channels[0]
        const cleanChannelId = firstChannel.channelId.toString().startsWith('@')
          ? firstChannel.channelId.toString()
          : `@${firstChannel.channelId}`

        const inviteResponse = await fetch(
          `https://api.telegram.org/bot${process.env.BOT_TOKEN}/createChatInviteLink`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: cleanChannelId,
              member_limit: 1,
              name: 'Debug Test Invite',
              expire_date: Math.floor(Date.now() / 1000) + 300 // 5 минут
            })
          }
        )

        const inviteResult = await inviteResponse.json()
        inviteLinkTest = {
          success: inviteResult.ok,
          channelName: firstChannel.name,
          channelId: cleanChannelId,
          result: inviteResult.ok ? inviteResult.result : null,
          error: !inviteResult.ok ? inviteResult.description : null
        }
      } catch (error) {
        inviteLinkTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envVars,
      bot: botStatus,
      testMessage: testMessageResult,
      inviteLinkTest,
      channels: channels.map(ch => ({
        channelId: ch.channelId.toString(),
        name: ch.name,
        productsCount: ch._count.products
      })),
      recentDemoAccesses: recentDemoAccesses.map(demo => ({
        user: {
          telegramId: demo.user.telegramId.toString(),
          firstName: demo.user.firstName,
          username: demo.user.username
        },
        product: {
          name: demo.product.name,
          channel: {
            channelId: demo.product.channel.channelId.toString(),
            name: demo.product.channel.name
          }
        },
        startedAt: demo.startedAt.toISOString(),
        expiresAt: demo.expiresAt.toISOString(),
        isActive: demo.isActive
      })),
      recentSubscriptions: recentSubscriptions.map(sub => ({
        user: {
          telegramId: sub.user.telegramId.toString(),
          firstName: sub.user.firstName,
          username: sub.user.username
        },
        product: {
          name: sub.product?.name || 'Unknown Product',
          channel: {
            channelId: sub.product?.channel?.channelId?.toString() || 'unknown',
            name: sub.product?.channel?.name || 'Unknown Channel'
          }
        },
        createdAt: sub.createdAt.toISOString(),
        expiresAt: sub.expiresAt.toISOString(),
        status: sub.status
      }))
    })

  } catch (error) {
    console.error('❌ Error in full bot messages debug:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}