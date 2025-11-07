import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

// Утилита для безопасной сериализации BigInt
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}

// Функция для создания аутентифицированного ответа
function createJsonResponse(data: any, status: number = 200): NextResponse {
  return new NextResponse(safeStringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// Функция для проверки админ прав
async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  try {
    const initData = request.headers.get('x-telegram-init-data');

    if (!initData) {
      return false
    }

    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return false
    }

    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')

    if (!userStr) {
      return false
    }

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    const admin = await prisma.admin.findUnique({
      where: { telegramId }
    })

    return !!admin
  } catch (error) {
    console.error('Auth error:', error)
    return false
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const demoId = params.id

    // Проверяем существование демо-доступа
    const existingDemoAccess = await prisma.demoAccess.findUnique({
      where: { id: demoId }
    })

    if (!existingDemoAccess) {
      return createJsonResponse(
        { error: 'Demo access not found' },
        404
      )
    }

    // Деактивируем демо-доступ
    await prisma.demoAccess.update({
      where: { id: demoId },
      data: {
        isActive: false
      }
    })

    return createJsonResponse({ success: true })

  } catch (error) {
    console.error('Error revoking demo access:', error)
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}