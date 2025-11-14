import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateTelegramInitData } from '@/lib/utils';
import { BroadcastTargetType } from '@prisma/client';

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

// POST /api/admin/broadcasts/preview - Предпросмотр получателей рассылки
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { targetType, filters, limit = 100, excludedUsers = [] } = body;

    if (!targetType) {
      return NextResponse.json({ error: 'Отсутствует targetType' }, { status: 400 });
    }

    if (!Object.values(BroadcastTargetType).includes(targetType)) {
      return NextResponse.json({ error: 'Недопустимый тип цели рассылки' }, { status: 400 });
    }

    // Получение предпросмотра получателей
    const previewRecipients = await getPreviewRecipients(targetType, filters, limit, excludedUsers);

    // Получение общего количества получателей
    const totalCount = await getTotalRecipientsCount(targetType, filters, excludedUsers);

    return NextResponse.json(serializeBigInt({
      totalCount,
      previewCount: previewRecipients.length,
      recipients: previewRecipients
    }));

  } catch (error) {
    console.error('[BROADCAST_PREVIEW]', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// Получение предпросмотра получателей
async function getPreviewRecipients(targetType: BroadcastTargetType, filters: any[], limit: number, excludedUsers: string[] = []) {
  let whereClause: any = {};

  switch (targetType) {
    case BroadcastTargetType.ALL_USERS:
      // Все пользователи
      break;

    case BroadcastTargetType.ACTIVE_SUBSCRIPTIONS:
      // Пользователи с активными подписками
      whereClause.subscriptions = {
        some: {
          status: 'active',
          expiresAt: {
            gte: new Date()
          }
        }
      };
      break;

    case BroadcastTargetType.EXPIRED_SUBSCRIPTIONS:
      // Пользователи с истекшими подписками
      whereClause.subscriptions = {
        some: {
          status: 'active',
          expiresAt: {
            lt: new Date()
          }
        }
      };
      break;

    case BroadcastTargetType.TRIAL_USERS:
      // Пользователи с демо-доступом
      whereClause.demoAccess = {
        some: {
          isActive: true
        }
      };
      break;

    case BroadcastTargetType.PRODUCT_SPECIFIC:
      // Пользователи конкретного продукта
      const productFilter = filters?.find((f: any) => f.filterType === 'PRODUCT_ID');
      if (productFilter) {
        whereClause.subscriptions = {
          some: {
            productId: productFilter.filterValue,
            status: 'active',
            expiresAt: {
              gte: new Date()
            }
          }
        };
      }
      break;

    case BroadcastTargetType.CHANNEL_SPECIFIC:
      // Пользователи конкретного канала
      const channelFilter = filters?.find((f: any) => f.filterType === 'CHANNEL_ID');
      if (channelFilter) {
        whereClause.subscriptions = {
          some: {
            channelId: BigInt(channelFilter.filterValue),
            status: 'active',
            expiresAt: {
              gte: new Date()
            }
          }
        };
      }
      break;

    case BroadcastTargetType.CUSTOM_FILTER:
      // Применение кастомных фильтров
      if (filters) {
        filters.forEach((filter: any) => {
          switch (filter.filterType) {
            case 'REGISTRATION_DATE':
              // Фильтр по дате регистрации
              const dateFilter = JSON.parse(filter.filterValue);
              whereClause.createdAt = {
                gte: new Date(dateFilter.from),
                lte: new Date(dateFilter.to)
              };
              break;

            case 'SUBSCRIPTION_STATUS':
              // Фильтр по статусу подписки
              if (filter.filterValue === 'active') {
                whereClause.subscriptions = {
                  some: {
                    status: 'active',
                    expiresAt: {
                      gte: new Date()
                    }
                  }
                };
              } else if (filter.filterValue === 'expired') {
                whereClause.subscriptions = {
                  some: {
                    status: 'active',
                    expiresAt: {
                      lt: new Date()
                    }
                  }
                };
              }
              break;
          }
        });
      }
      break;
  }

  // Добавляем исключение пользователей
  if (excludedUsers.length > 0) {
    whereClause.telegramId = {
      notIn: excludedUsers.map(id => BigInt(id))
    };
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      telegramId: true,
      firstName: true,
      username: true,
      createdAt: true,
      subscriptions: {
        select: {
          status: true,
          expiresAt: true,
          product: {
            select: {
              name: true,
              channel: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        where: {
          status: 'active'
        },
        orderBy: {
          expiresAt: 'desc'
        },
        take: 1
      },
      demoAccess: {
        select: {
          isActive: true,
          expiresAt: true,
          product: {
            select: {
              name: true
            }
          }
        },
        where: {
          isActive: true
        },
        take: 1
      }
    },
    take: limit,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return users.map(user => ({
    telegramId: user.telegramId.toString(),
    firstName: user.firstName,
    username: user.username,
    createdAt: user.createdAt,
    subscriptionStatus: user.subscriptions.length > 0
      ? `Активна до ${user.subscriptions[0].expiresAt.toLocaleDateString('ru-RU')}`
      : 'Нет подписки',
    productName: user.subscriptions[0]?.product?.name || user.demoAccess[0]?.product?.name || 'Нет',
    channelName: user.subscriptions[0]?.product?.channel?.name || 'Нет',
    hasDemoAccess: user.demoAccess.length > 0 && user.demoAccess[0].isActive
  }));
}

// Получение общего количества получателей
async function getTotalRecipientsCount(targetType: BroadcastTargetType, filters: any[], excludedUsers: string[] = []) {
  let whereClause: any = {};

  // Аналогичная логика фильтрации как в getPreviewRecipients
  switch (targetType) {
    case BroadcastTargetType.ALL_USERS:
      break;

    case BroadcastTargetType.ACTIVE_SUBSCRIPTIONS:
      whereClause.subscriptions = {
        some: {
          status: 'active',
          expiresAt: {
            gte: new Date()
          }
        }
      };
      break;

    case BroadcastTargetType.EXPIRED_SUBSCRIPTIONS:
      whereClause.subscriptions = {
        some: {
          status: 'active',
          expiresAt: {
            lt: new Date()
          }
        }
      };
      break;

    case BroadcastTargetType.TRIAL_USERS:
      whereClause.demoAccess = {
        some: {
          isActive: true
        }
      };
      break;

    case BroadcastTargetType.PRODUCT_SPECIFIC:
      const productFilter = filters?.find((f: any) => f.filterType === 'PRODUCT_ID');
      if (productFilter) {
        whereClause.subscriptions = {
          some: {
            productId: productFilter.filterValue,
            status: 'active',
            expiresAt: {
              gte: new Date()
            }
          }
        };
      }
      break;

    case BroadcastTargetType.CHANNEL_SPECIFIC:
      const channelFilter = filters?.find((f: any) => f.filterType === 'CHANNEL_ID');
      if (channelFilter) {
        whereClause.subscriptions = {
          some: {
            channelId: BigInt(channelFilter.filterValue),
            status: 'active',
            expiresAt: {
              gte: new Date()
            }
          }
        };
      }
      break;

    case BroadcastTargetType.CUSTOM_FILTER:
      if (filters) {
        filters.forEach((filter: any) => {
          switch (filter.filterType) {
            case 'REGISTRATION_DATE':
              const dateFilter = JSON.parse(filter.filterValue);
              whereClause.createdAt = {
                gte: new Date(dateFilter.from),
                lte: new Date(dateFilter.to)
              };
              break;

            case 'SUBSCRIPTION_STATUS':
              if (filter.filterValue === 'active') {
                whereClause.subscriptions = {
                  some: {
                    status: 'active',
                    expiresAt: {
                      gte: new Date()
                    }
                  }
                };
              } else if (filter.filterValue === 'expired') {
                whereClause.subscriptions = {
                  some: {
                    status: 'active',
                    expiresAt: {
                      lt: new Date()
                    }
                  }
                };
              }
              break;
          }
        });
      }
      break;
  }

  // Добавляем исключение пользователей
  if (excludedUsers.length > 0) {
    whereClause.telegramId = {
      notIn: excludedUsers.map(id => BigInt(id))
    };
  }

  return await prisma.user.count({
    where: whereClause
  });
}