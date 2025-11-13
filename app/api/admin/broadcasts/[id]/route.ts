import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateTelegramInitData } from '@/lib/utils';
import { BroadcastStatus } from '@prisma/client';

// GET /api/admin/broadcasts/[id] - Получение детальной информации о рассылке
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверка прав администратора
    const initData = request.headers.get('x-telegram-init-data');
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
      where: { broadcastId: params.id },
      include: {
        creator: {
          select: {
            firstName: true,
            username: true
          }
        },
        filters: true,
        _count: {
          select: {
            messages: true
          }
        }
      }
    });

    if (!broadcast) {
      return NextResponse.json({ error: 'Рассылка не найдена' }, { status: 404 });
    }

    return NextResponse.json(broadcast);

  } catch (error) {
    console.error('[BROADCAST_GET]', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// PUT /api/admin/broadcasts/[id] - Обновление рассылки
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверка прав администратора
    const initData = request.headers.get('x-telegram-init-data');
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

    if (broadcast.status === BroadcastStatus.SENDING || broadcast.status === BroadcastStatus.COMPLETED) {
      return NextResponse.json({ error: 'Нельзя изменить рассылку в процессе отправки' }, { status: 400 });
    }

    const body = await request.json();
    const { title, message, scheduledAt, status } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (message !== undefined) updateData.message = message;
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (status !== undefined) {
      if (broadcast.status === BroadcastStatus.SCHEDULED && status === BroadcastStatus.DRAFT) {
        updateData.status = status;
      } else if (broadcast.status === BroadcastStatus.DRAFT && scheduledAt) {
        updateData.status = BroadcastStatus.SCHEDULED;
      }
    }

    const updatedBroadcast = await prisma.broadcast.update({
      where: { broadcastId: params.id },
      data: updateData,
      include: {
        filters: true,
        creator: {
          select: {
            firstName: true,
            username: true
          }
        }
      }
    });

    return NextResponse.json(updatedBroadcast);

  } catch (error) {
    console.error('[BROADCAST_PUT]', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// DELETE /api/admin/broadcasts/[id] - Удаление рассылки
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Проверка прав администратора
    const initData = request.headers.get('x-telegram-init-data');
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

    if (broadcast.status === BroadcastStatus.SENDING) {
      return NextResponse.json({ error: 'Нельзя удалить рассылку в процессе отправки' }, { status: 400 });
    }

    await prisma.broadcast.delete({
      where: { broadcastId: params.id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[BROADCAST_DELETE]', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}