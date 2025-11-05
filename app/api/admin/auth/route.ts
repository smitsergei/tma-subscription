import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

interface AuthRequest {
  initData: string
}

export async function POST(request: NextRequest) {
  try {
    const body: AuthRequest = await request.json()
    const { initData } = body

    if (!initData) {
      return NextResponse.json(
        { success: false, error: 'Данные авторизации отсутствуют' },
        { status: 400 }
      )
    }

    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return NextResponse.json(
        { success: false, error: 'Неверные данные авторизации' },
        { status: 401 }
      )
    }

    // Получение ID пользователя из initData
    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')
    if (!userStr) {
      return NextResponse.json(
        { success: false, error: 'Не удалось получить данные пользователя' },
        { status: 400 }
      )
    }

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    // Проверка, является ли пользователь администратором
    const admin = await prisma.admin.findUnique({
      where: { telegramId },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            username: true
          }
        }
      }
    })

    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен. У вас нет прав администратора.' },
        { status: 403 }
      )
    }

    // Создание или обновление пользователя
    await prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName: user.first_name,
        username: user.username
      },
      create: {
        telegramId,
        firstName: user.first_name,
        username: user.username
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        user: {
          telegramId: admin.user.telegramId.toString(),
          firstName: admin.user.firstName,
          username: admin.user.username
        }
      },
      message: 'Авторизация успешна'
    })
  } catch (error) {
    console.error('Error during admin auth:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка авторизации' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get('x-telegram-init-data')
    if (!initData) {
      return NextResponse.json(
        { success: false, error: 'Требуется авторизация' },
        { status: 401 }
      )
    }

    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return NextResponse.json(
        { success: false, error: 'Неверные данные авторизации' },
        { status: 401 }
      )
    }

    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')
    if (!userStr) {
      return NextResponse.json(
        { success: false, error: 'Не удалось получить данные пользователя' },
        { status: 400 }
      )
    }

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    const admin = await prisma.admin.findUnique({
      where: { telegramId }
    })

    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: { authenticated: true }
    })
  } catch (error) {
    console.error('Error checking admin auth:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка проверки авторизации' },
      { status: 500 }
    )
  }
}