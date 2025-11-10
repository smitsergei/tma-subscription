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

  return !!admin
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const channelId = params.id

    if (!channelId) {
      return NextResponse.json(
        { error: 'Channel ID is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Looking for channel with ID:', channelId)

    const channel = await prisma.channel.findUnique({
      where: { channelId: BigInt(channelId) }
    })

    if (!channel) {
      console.log('❌ Channel not found:', channelId)
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      )
    }

    console.log('✅ Found channel:', channel.name)

    // Конвертируем BigInt в string для JSON сериализации
    const serializedChannel = {
      channelId: channel.channelId.toString(),
      name: channel.name,
      username: channel.username,
      description: channel.description,
      createdAt: channel.createdAt
    }

    return NextResponse.json({ channel: serializedChannel })

  } catch (error) {
    console.error('Error fetching channel:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}