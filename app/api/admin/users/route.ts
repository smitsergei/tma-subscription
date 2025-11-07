import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
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
}

export async function GET(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get users with their subscriptions
    const users = await prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptions: {
          include: {
            product: true,
            payment: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    const total = await prisma.user.count({ where })

    // Filter by subscription status if provided
    let filteredUsers = users
    if (status) {
      filteredUsers = users.filter(user => {
        const activeSubscription = user.subscriptions.find(sub => sub.status === 'active')
        return status === 'active' ? activeSubscription : !activeSubscription
      })
    }

    return NextResponse.json({
      users: filteredUsers.map(user => ({
        telegramId: user.telegramId.toString(),
        firstName: user.firstName,
        username: user.username,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        subscriptions: user.subscriptions.map(sub => ({
          subscriptionId: sub.subscriptionId,
          userId: sub.userId.toString(),
          productId: sub.productId,
          status: sub.status,
          expiresAt: sub.expiresAt,
          createdAt: sub.createdAt,
          product: sub.product,
          payment: sub.payment
        })),
        _count: user._count
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching users:', error)
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

    const { telegramId, firstName, username } = await request.json()

    if (!telegramId) {
      return NextResponse.json(
        { error: 'telegramId is required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      )
    }

    const user = await prisma.user.create({
      data: {
        telegramId: BigInt(telegramId),
        firstName: firstName || '',
        username: username || ''
      }
    })

    return NextResponse.json({ user })

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const telegramId = searchParams.get('telegramId')

    if (!telegramId) {
      return NextResponse.json(
        { error: 'telegramId is required' },
        { status: 400 }
      )
    }

    // Delete user's subscriptions first
    await prisma.subscription.deleteMany({
      where: {
        user: { telegramId: BigInt(telegramId) }
      }
    })

    // Delete user
    await prisma.user.delete({
      where: { telegramId: BigInt(telegramId) }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}