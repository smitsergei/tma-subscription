import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateTelegramInitData } from '@/lib/utils';
import { BroadcastTargetType, BroadcastStatus } from '@prisma/client';

// GET /api/admin/broadcasts - Получение списка рассылок
export async function GET(request: NextRequest) {
  try {
    // Проверка прав администратора
    const initData = request.headers.get('x-telegram-init-data');
    if (!initData) {
      return NextResponse.json({ error: 'Отсутствует авторизация' }, { status: 401 });
    }

    const isValid = validateTelegramInitData(initData, process.env.BOT_TOKEN || '');

    if (!isValid) {
      return NextResponse.json({ error: 'Ошибка авторизации' }, { status: 401 });
    }

    // Получение ID пользователя из initData
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (!userStr) {
      return NextResponse.json({ error: 'Не удалось получить данные пользователя' }, { status: 400 });
    }

    const user = JSON.parse(decodeURIComponent(userStr));
    const telegramId = BigInt(user.id);

    // Проверка прав администратора
    const admin = await prisma.admin.findUnique({
      where: { telegramId },
      include: { user: true }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') as BroadcastStatus | null;

    const where = status ? { status } : {};

    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        where,
        include: {
          creator: {
            select: {
              firstName: true,
              username: true
            }
          },
          _count: {
            select: {
              messages: true,
              filters: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.broadcast.count({ where })
    ]);

    return NextResponse.json({
      broadcasts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('[BROADCASTS_GET]', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// POST /api/admin/broadcasts - Создание новой рассылки
export async function POST(request: NextRequest) {
  try {
    // Проверка прав администратора
    const initData = request.headers.get('x-telegram-init-data');
    if (!initData) {
      return NextResponse.json({ error: 'Отсутствует авторизация' }, { status: 401 });
    }

    const isValid = validateTelegramInitData(initData, process.env.BOT_TOKEN || '');

    if (!isValid) {
      return NextResponse.json({ error: 'Ошибка авторизации' }, { status: 401 });
    }

    // Получение ID пользователя из initData
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (!userStr) {
      return NextResponse.json({ error: 'Не удалось получить данные пользователя' }, { status: 400 });
    }

    const user = JSON.parse(decodeURIComponent(userStr));
    const telegramId = BigInt(user.id);

    // Проверка прав администратора
    const admin = await prisma.admin.findUnique({
      where: { telegramId }
    });

    if (!admin) {
      return NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 });
    }

    const body = await request.json();
    const { title, message, targetType, scheduledAt, filters, excludedUsers = [] } = body;

    if (!title || !message || !targetType) {
      return NextResponse.json({
        error: 'Отсутствуют обязательные поля: title, message, targetType'
      }, { status: 400 });
    }

    if (!Object.values(BroadcastTargetType).includes(targetType)) {
      return NextResponse.json({ error: 'Недопустимый тип цели рассылки' }, { status: 400 });
    }

    // Создание рассылки
    const broadcast = await prisma.broadcast.create({
      data: {
        title,
        message,
        targetType,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdBy: telegramId,
        status: scheduledAt ? BroadcastStatus.SCHEDULED : BroadcastStatus.DRAFT,
        filters: {
          create: [
            // Добавляем существующие фильтры
            ...(filters ? filters.map((filter: any) => ({
              filterType: filter.filterType,
              filterValue: filter.filterValue
            })) : []),
            // Добавляем исключенных пользователей как специальный фильтр
            ...(excludedUsers.length > 0 ? [{
              filterType: 'EXCLUDED_USERS',
              filterValue: JSON.stringify(excludedUsers)
            }] : [])
          ]
        }
      },
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

    return NextResponse.json(broadcast, { status: 201 });

  } catch (error) {
    console.error('[BROADCASTS_POST]', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}