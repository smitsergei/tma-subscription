import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateTelegramInitData } from '@/lib/utils';
import { BroadcastTargetType, BroadcastStatus, MessageStatus } from '@prisma/client';

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

// POST /api/admin/broadcasts/[id]/send - Отправка рассылки
export async function POST(
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
        filters: true
      }
    });

    if (!broadcast) {
      return NextResponse.json({ error: 'Рассылка не найдена' }, { status: 404 });
    }

    if (broadcast.status !== BroadcastStatus.DRAFT && broadcast.status !== BroadcastStatus.SCHEDULED) {
      return NextResponse.json({ error: 'Рассылка уже отправлена или в процессе отправки' }, { status: 400 });
    }

    // Получение списка получателей
    const recipients = await getRecipients(broadcast.targetType, broadcast.filters);

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'Нет получателей для рассылки' }, { status: 400 });
    }

    // Обновление статуса рассылки
    await prisma.broadcast.update({
      where: { broadcastId: params.id },
      data: {
        status: BroadcastStatus.SENDING,
        totalRecipients: recipients.length,
        sentAt: new Date()
      }
    });

    // Создание сообщений для отправки
    const messages = recipients.map(userId => ({
      broadcastId: params.id,
      userId,
      status: MessageStatus.PENDING
    }));

    await prisma.broadcastMessage.createMany({
      data: messages
    });

    // Запуск фоновой задачи для отправки сообщений
    // Здесь можно использовать очереди сообщений (Bull, Agenda, etc.)
    // Для простоты используем Promise без await
    sendMessagesAsync(params.id, broadcast.message, recipients);

    return NextResponse.json(serializeBigInt({
      success: true,
      totalRecipients: recipients.length,
      message: 'Рассылка запущена'
    }));

  } catch (error) {
    console.error('[BROADCAST_SEND]', error);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

// Получение списка получателей на основе типа цели и фильтров
async function getRecipients(targetType: BroadcastTargetType, filters: any[]) {
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
      const productFilter = filters.find(f => f.filterType === 'PRODUCT_ID');
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
      const channelFilter = filters.find(f => f.filterType === 'CHANNEL_ID');
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
      filters.forEach(filter => {
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
      break;
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      telegramId: true,
      firstName: true,
      username: true
    }
  });

  return users.map(u => u.telegramId);
}

// Асинхронная отправка сообщений
async function sendMessagesAsync(broadcastId: string, message: string, recipients: bigint[]) {
  try {
    // Получение API ключа Telegram бота из переменных окружения
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN не настроен');
    }

    // Получение всех сообщений для отправки
    const messages = await prisma.broadcastMessage.findMany({
      where: {
        broadcastId,
        status: MessageStatus.PENDING
      }
    });

    for (const messageRecord of messages) {
      try {
        // Отправка сообщения через Telegram Bot API
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: messageRecord.userId.toString(),
            text: message,
            parse_mode: 'HTML'
          })
        });

        if (response.ok) {
          const result = await response.json();

          // Обновление статуса сообщения
          await prisma.broadcastMessage.update({
            where: { messageId: messageRecord.messageId },
            data: {
              status: MessageStatus.SENT,
              sentAt: new Date(),
              telegramMessageId: result.result.message_id
            }
          });

          // Обновление счетчиков в рассылке
          await prisma.broadcast.update({
            where: { broadcastId },
            data: {
              sentCount: {
                increment: 1
              }
            }
          });
        } else {
          const error = await response.json();
          throw new Error(error.description || 'Failed to send message');
        }

        // Небольшая задержка между сообщениями для избежания лимитов Telegram
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[SEND_MESSAGE_ERROR] User: ${messageRecord.userId}`, error);

        // Обновление статуса сообщения как FAILED
        await prisma.broadcastMessage.update({
          where: { messageId: messageRecord.messageId },
          data: {
            status: MessageStatus.FAILED,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });

        // Обновление счетчиков в рассылке
        await prisma.broadcast.update({
          where: { broadcastId },
          data: {
            failedCount: {
              increment: 1
            }
          }
        });
      }
    }

    // Завершение рассылки
    await prisma.broadcast.update({
      where: { broadcastId },
      data: {
        status: BroadcastStatus.COMPLETED
      }
    });

  } catch (error) {
    console.error('[BROADCAST_SEND_ASYNC_ERROR]', error);

    // Отметка рассылки как неуспешной
    await prisma.broadcast.update({
      where: { broadcastId },
      data: {
        status: BroadcastStatus.FAILED
      }
    });
  }
}