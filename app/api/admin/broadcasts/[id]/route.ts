import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateTelegramInitData } from '@/lib/utils';
import { BroadcastStatus } from '@prisma/client';

// Функция для сериализации BigInt в строки
const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = serializeBigInt(obj[key]);
      }
    }
    return serialized;
  }

  return obj;
};

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

    return NextResponse.json(serializeBigInt(broadcast));

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
    const { title, message, scheduledAt, status, filters, excludedUsers = [] } = body;

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

    // Обновление фильтров и исключенных пользователей
    if (filters !== undefined || excludedUsers.length > 0) {
      // Удаляем существующие фильтры
      await prisma.broadcastFilter.deleteMany({
        where: { broadcastId: params.id }
      });

      // Создаем новые фильтры
      const newFilters = [];

      // Добавляем существующие фильтры (кроме EXCLUDED_USERS)
      if (filters) {
        filters.forEach((filter: any) => {
          if (filter.filterType !== 'EXCLUDED_USERS') {
            newFilters.push({
              filterType: filter.filterType,
              filterValue: filter.filterValue
            });
          }
        });
      }

      // Добавляем исключенных пользователей как специальный фильтр
      if (excludedUsers.length > 0) {
        newFilters.push({
          filterType: 'EXCLUDED_USERS',
          filterValue: JSON.stringify(excludedUsers)
        });
      }

      if (newFilters.length > 0) {
        updateData.filters = {
          create: newFilters
        };
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

    return NextResponse.json(serializeBigInt(updatedBroadcast));

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