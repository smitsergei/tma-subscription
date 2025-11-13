import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { telegramService } from '@/lib/telegramService';
import { BroadcastStatus, BroadcastTargetType, MessageStatus } from '@prisma/client';

/**
 * Cron job для обработки запланированных рассылок
 * Вызывается по расписанию (каждую минуту)
 */
export async function GET(request: NextRequest) {
  try {
    // Проверка секретного ключа для cron
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Поиск запланированных рассылок, время которых наступило
    const scheduledBroadcasts = await prisma.broadcast.findMany({
      where: {
        status: BroadcastStatus.SCHEDULED,
        scheduledAt: {
          lte: now
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

    console.log(`Found ${scheduledBroadcasts.length} scheduled broadcasts to process`);

    for (const broadcast of scheduledBroadcasts) {
      try {
        // Обновление статуса на "Отправка"
        await prisma.broadcast.update({
          where: { broadcastId: broadcast.broadcastId },
          data: {
            status: BroadcastStatus.SENDING,
            sentAt: now
          }
        });

        // Получение списка получателей
        const recipients = await getRecipients(broadcast.targetType, broadcast.filters);

        if (recipients.length === 0) {
          await prisma.broadcast.update({
            where: { broadcastId: broadcast.broadcastId },
            data: {
              status: BroadcastStatus.COMPLETED,
              totalRecipients: 0
            }
          });
          console.log(`Broadcast ${broadcast.broadcastId} has no recipients`);
          continue;
        }

        // Обновление общего количества получателей
        await prisma.broadcast.update({
          where: { broadcastId: broadcast.broadcastId },
          data: {
            totalRecipients: recipients.length
          }
        });

        // Создание записей о сообщениях
        const messages = recipients.map(userId => ({
          broadcastId: broadcast.broadcastId,
          userId,
          status: MessageStatus.PENDING
        }));

        await prisma.broadcastMessage.createMany({
          data: messages
        });

        // Запуск фоновой отправки сообщений
        sendBroadcastAsync(broadcast.broadcastId, broadcast.message, recipients);

        console.log(`Started sending broadcast ${broadcast.broadcastId} to ${recipients.length} recipients`);

      } catch (error) {
        console.error(`Error processing broadcast ${broadcast.broadcastId}:`, error);

        // Отметка рассылки как неудачной
        await prisma.broadcast.update({
          where: { broadcastId: broadcast.broadcastId },
          data: {
            status: BroadcastStatus.FAILED
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: scheduledBroadcasts.length,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('[SCHEDULED_BROADCASTS_CRON]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Получение списка получателей на основе типа цели и фильтров
 */
async function getRecipients(targetType: BroadcastTargetType, filters: any[]) {
  let whereClause: any = {};

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
      filters.forEach(filter => {
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
      break;
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      telegramId: true
    }
  });

  return users.map(u => u.telegramId);
}

/**
 * Асинхронная отправка рассылки
 */
async function sendBroadcastAsync(broadcastId: string, message: string, recipients: bigint[]) {
  try {
    await telegramService.sendBroadcast(broadcastId, message, recipients);

    // Завершение рассылки
    await prisma.broadcast.update({
      where: { broadcastId },
      data: {
        status: BroadcastStatus.COMPLETED
      }
    });

    console.log(`Broadcast ${broadcastId} completed successfully`);

  } catch (error) {
    console.error(`[BROADCAST_SEND_ASYNC_ERROR] ${broadcastId}`, error);

    // Отметка рассылки как неуспешной
    await prisma.broadcast.update({
      where: { broadcastId },
      data: {
        status: BroadcastStatus.FAILED
      }
    });
  }
}