import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

// Функция для проверки админ прав
async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  try {
    const initData = request.headers.get('x-telegram-init-data')
    if (!initData) return false

    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) return false

    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')
    if (!userStr) return false

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    const admin = await prisma.admin.findUnique({
      where: { telegramId }
    })

    return !!admin
  } catch (error) {
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channels = await prisma.channel.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      channels: channels.map(channel => ({
        id: channel.channelId.toString(),
        name: channel.name,
        username: channel.username,
        description: channel.description,
        createdAt: channel.createdAt
      }))
    })

  } catch (error) {
    console.error('Error fetching channels:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, username, channelId, description } = await request.json()

    if (!name || !channelId) {
      return NextResponse.json(
        { error: 'Channel name and ID are required' },
        { status: 400 }
      )
    }

    // Clean channel ID (remove @ if present for negative IDs)
    const cleanChannelId = channelId.startsWith('@')
      ? channelId.slice(1)
      : channelId

    let finalChannelId = cleanChannelId
    // If it looks like a username (not numeric), make it negative
    if (!/^\d+$/.test(cleanChannelId)) {
      finalChannelId = `-${Math.abs(cleanChannelId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0))}`
    }

    const channel = await prisma.channel.create({
      data: {
        channelId: BigInt(finalChannelId),
        name,
        username: username || null,
        description: description || null
      }
    })

    return NextResponse.json({
      channel: {
        id: channel.channelId.toString(),
        name: channel.name,
        username: channel.username,
        description: channel.description,
        createdAt: channel.createdAt
      }
    })

  } catch (error) {
    console.error('Error creating channel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}