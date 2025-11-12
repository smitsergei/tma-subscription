import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging demo message functionality...')

    // Проверяем переменные окружения
    const envVars = {
      BOT_TOKEN: !!process.env.BOT_TOKEN,
      APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      BOT_TOKEN_LENGTH: process.env.BOT_TOKEN?.length || 0
    }

    // Получаем информацию о каналах из БД
    const channels = await prisma.channel.findMany({
      include: {
        products: {
          select: {
            productId: true,
            name: true,
            allowDemo: true
          }
        }
      }
    })

    // Проверяем последний демо-доступ
    const lastDemo = await prisma.demoAccess.findFirst({
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

    // Если есть последний демо-доступ, проверяем формат channelId
    let channelIdTest = null
    if (lastDemo && lastDemo.product.channel) {
      const channelId = lastDemo.product.channel.channelId
      channelIdTest = {
        original: channelId,
        withAt: `@${channelId}`,
        startsWithAt: channelId.toString().startsWith('@'),
        cleanAt: channelId.toString().startsWith('@') ? channelId.toString() : `@${channelId}`
      }
    }

    // Тестируем создание invite link
    let inviteLinkTest = null
    if (lastDemo && lastDemo.product.channel && process.env.BOT_TOKEN) {
      try {
        const botToken = process.env.BOT_TOKEN
        const channelId = lastDemo.product.channel.channelId
        const cleanChannelId = channelId.toString().startsWith('@') ? channelId.toString() : `@${channelId}`

        const inviteResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: cleanChannelId,
              member_limit: 1,
              name: 'Debug Test Invite',
              expire_date: Math.floor(Date.now() / 1000) + 300 // 5 минут для теста
            })
          }
        )

        const inviteResult = await inviteResponse.json()
        inviteLinkTest = {
          success: inviteResult.ok,
          result: inviteResult.ok ? inviteResult.result : null,
          error: !inviteResult.ok ? inviteResult.description : null,
          channelId: cleanChannelId
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
      channels: channels.map(ch => ({
        channelId: ch.channelId.toString(),
        name: ch.name,
        productsCount: ch.products.length
      })),
      lastDemoAccess: lastDemo ? {
        user: {
          telegramId: lastDemo.user.telegramId.toString(),
          firstName: lastDemo.user.firstName
        },
        product: {
          name: lastDemo.product.name,
          channel: {
            channelId: lastDemo.product.channel.channelId.toString(),
            name: lastDemo.product.channel.name
          }
        },
        startedAt: lastDemo.startedAt.toISOString(),
        expiresAt: lastDemo.expiresAt.toISOString()
      } : null,
      channelIdTest,
      inviteLinkTest
    })

  } catch (error) {
    console.error('❌ Error debugging demo message:', error)
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