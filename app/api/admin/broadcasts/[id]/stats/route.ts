import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateTelegramInitData } from '@/lib/utils';
import { MessageStatus } from '@prisma/client';

// GET /api/admin/broadcasts/[id]/stats - Получение статистики рассылки
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверка прав администратора
    
    if (!initData) {
      return NextResponse.json({ error: 'Отсутствует авторизация' }, { status: 401 });
    }

    
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (!userStr) {
      return NextResponse.json({ error: 'Не удалось получить данные пользователя' }, { status: 400 });
    }

    const user = JSON.parse(decodeURIComponent(userStr));
    const telegramId = BigInt(user.id);
    const isValid = validateTelegramInitData(initData, process.env.BOT_TOKEN || '');

    if (!isValid) {
      return NextResponse.json({ error: 'Ошибка авторизации' }, { status: 401 });
    }

    // Проверка прав администратора
    const admin = await prisma.admin.findUnique({
      where: { telegramId: BigInt(telegramId) }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { broadcastId: params.id }
    });

    if (!broadcast) {
      return NextResponse.json({ error: 'Рассылка не найдена' }, { status: 404 });
    }

    // Получение детальной статистики по сообщениям
    const messageStats = await prisma.broadcastMessage.groupBy({
      by: ['status'],
      where: {
        broadcastId: params.id
      },
      _count: {
        status: true
      }
    });

    // Преобразование статистики в удобный формат
    const stats = {
      totalRecipients: broadcast.totalRecipients,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
      pendingCount: 0,
      status: broadcast.status,
      details: {
        pending: 0,
        sent: 0,
        failed: 0
      }
    };

    messageStats.forEach(stat => {
      const count = stat._count.status;
      stats.details[stat.status.toLowerCase() as keyof typeof stats.details] = count;

      if (stat.status === MessageStatus.PENDING) {
        stats.pendingCount = count;
      }
    });

    // Получение последних неудачных отправок с ошибками
    const recentFailures = await prisma.broadcastMessage.findMany({
      where: {
        broadcastId: params.id,
        status: MessageStatus.FAILED,
        error: {
          not: null
        }
      },
      include: {
        user: {
          select: {
            firstName: true,
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    // Получение прогресса отправки в процентах
    const progressPercentage = broadcast.totalRecipients > 0
      ? Math.round(((broadcast.sentCount + broadcast.failedCount) / broadcast.totalRecipients) * 100)
      : 0;

    return NextResponse.json({
      stats,
      recentFailures,
      progressPercentage,
      createdAt: broadcast.createdAt,
      sentAt: broadcast.sentAt,
      scheduledAt: broadcast.scheduledAt
    });

  } catch (error) {
    console.error('[BROADCAST_STATS]', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}