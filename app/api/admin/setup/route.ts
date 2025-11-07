import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST() {
  try {
    const adminTelegramId = 257394938; // Используем ID из скрипта

    console.log('🔧 Создание администратора...');

    // Сначала создаем пользователя
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(adminTelegramId) },
      update: {
        firstName: 'Admin',
        username: 'admin_user'
      },
      create: {
        telegramId: BigInt(adminTelegramId),
        firstName: 'Admin',
        username: 'admin_user'
      }
    });

    // Затем создаем администратора
    const admin = await prisma.admin.upsert({
      where: { telegramId: BigInt(adminTelegramId) },
      update: {},
      create: {
        telegramId: BigInt(adminTelegramId)
      }
    });

    console.log('✅ Администратор создан:', {
      user: user.telegramId.toString(),
      admin: admin.telegramId.toString()
    });

    return NextResponse.json({
      success: true,
      message: 'Администратор успешно создан',
      telegramId: adminTelegramId,
      user: {
        telegramId: user.telegramId.toString(),
        firstName: user.firstName,
        username: user.username
      }
    });

  } catch (error) {
    console.error('❌ Ошибка при создании администратора:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}