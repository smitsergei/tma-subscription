import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Проверка авторизации cron job (защита от несанкционированного запуска)
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('CRON_SECRET not set, skipping auth verification')
    return true
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию cron запроса
    if (!verifyCronAuth(request)) {
      console.log('❌ Invalid cron authorization');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting demo access check...');

    const now = new Date();
    console.log(`📅 Current time: ${now.toISOString()}`);

    // 0. Сначала отправляем уведомления о приближающемся окончании демо-доступа
    await sendDemoExpirationReminders();

    // 1. Проверяем истекшие демо-доступы для удаления пользователей
    const expiredDemoAccesses = await prisma.demoAccess.findMany({
      where: {
        isActive: true,
        expiresAt: {
          lt: now
        }
      },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            username: true
          }
        },
        product: {
          select: {
            productId: true,
            name: true,
            channel: {
              select: {
                channelId: true,
                name: true
              }
            }
          }
        }
      }
    });

    console.log(`🔍 Found ${expiredDemoAccesses.length} expired demo accesses`);

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      throw new Error('BOT_TOKEN not configured');
    }

    let processedCount = 0
    let errorCount = 0

    for (const demo of expiredDemoAccesses) {
      try {
        console.log(`🗑️ Processing expired demo: ${demo.id}`);
        console.log(`   User: ${demo.user.firstName} (${demo.user.telegramId})`);
        console.log(`   Product: ${demo.product.name}`);
        console.log(`   Channel: ${demo.product.channel.name} (${demo.product.channel.channelId})`);
        console.log(`   Expired at: ${demo.expiresAt.toISOString()}`);

        // Проверяем, есть ли активная платная подписка
        const activeSubscription = await prisma.subscription.findFirst({
          where: {
            userId: demo.user.telegramId,
            productId: demo.product.productId,
            status: 'active',
            expiresAt: {
              gt: now
            }
          }
        });

        if (activeSubscription) {
          console.log(`✅ User has active subscription, keeping access`);
          // Просто деактивируем демо, но не удаляем из канала
          await prisma.demoAccess.update({
            where: { id: demo.id },
            data: { isActive: false }
          });
          processedCount++
          continue;
        }

        // Удаляем пользователя из канала через Telegram Bot API
        await removeUserFromChannel(
          demo.user.telegramId.toString(),
          demo.product.channel.channelId.toString(),
          botToken
        );

        // Отправляем уведомление пользователю
        await sendDemoExpirationNotification(
          demo.user.telegramId.toString(),
          demo.product.name,
          demo.product.channel.name,
          botToken
        );

        // Обновляем статус демо-доступа
        await prisma.demoAccess.update({
          where: { id: demo.id },
          data: { isActive: false }
        });

        processedCount++
        console.log(`✅ Successfully processed expired demo: ${demo.id}`);

      } catch (error) {
        errorCount++
        console.error(`❌ Error processing expired demo ${demo.id}:`, error);
      }
    }

    // 2. Проверяем активные демо-доступы для добавления пользователей в каналы (на случай ошибок)
    const activeDemoAccesses = await prisma.demoAccess.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gt: now
        }
      },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            username: true
          }
        },
        product: {
          select: {
            productId: true,
            name: true,
            channel: {
              select: {
                channelId: true,
                name: true
              }
            }
          }
        }
      }
    });

    console.log(`🔍 Found ${activeDemoAccesses.length} active demo accesses`);

    for (const demo of activeDemoAccesses) {
      try {
        // Проверяем, есть ли у пользователя уже доступ (платная подписка)
        const activeSubscription = await prisma.subscription.findFirst({
          where: {
            userId: demo.user.telegramId,
            productId: demo.product.productId,
            status: 'active',
            expiresAt: {
              gt: now
            }
          }
        });

        if (activeSubscription) {
          // Если есть платная подписка, деактивируем демо
          await prisma.demoAccess.update({
            where: { id: demo.id },
            data: { isActive: false }
          });
          console.log(`✅ Demo deactivated due to active subscription: ${demo.id}`);
          continue;
        }

        // Добавляем пользователя в канал (если еще не добавлен)
        // Создаем или находим существующий invite link для демо-доступа
        let demoInviteLink = null;

        try {
          // Сначала пробуем найти существующую демо-ссылку
          const existingInvitesResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getChatInviteLinks`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chat_id: demo.product.channel.channelId.toString()
              })
            }
          );

          const existingInvitesData = await existingInvitesResponse.json();

          if (existingInvitesData.ok && existingInvitesData.result) {
            const existingInvite = existingInvitesData.result.find((invite: any) =>
              invite.name === 'Demo Access Invite' &&
              invite.member_limit === 1 &&
              !invite.is_revoked
            );

            if (existingInvite) {
              demoInviteLink = existingInvite.invite_link;
              console.log(`✅ Found existing demo invite link for user ${demo.user.telegramId}`);
            }
          }
        } catch (error) {
          console.log(`🔍 Could not check existing demo invites for user ${demo.user.telegramId}, creating new one:`, error);
        }

        // Если нет существующей ссылки, создаем новую
        if (!demoInviteLink) {
          const inviteResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chat_id: demo.product.channel.channelId.toString(),
                name: 'Demo Access Invite',
                member_limit: 1
                // Убрали expire_date, чтобы ссылка была постоянной
              })
            }
          );

          const inviteResult = await inviteResponse.json();
          if (inviteResult.ok) {
            demoInviteLink = inviteResult.result.invite_link;
            console.log(`✅ Created new demo invite link for demo user ${demo.user.telegramId}`);
          } else {
            console.error(`❌ Error creating demo invite link for demo user ${demo.user.telegramId}: ${inviteResult.description}`);
          }
        }

      } catch (error) {
        console.error(`❌ Error processing active demo ${demo.id}:`, error);
      }
    }

    const stats = {
      processed: processedCount,
      errors: errorCount,
      active: activeDemoAccesses.length,
      total: expiredDemoAccesses.length + activeDemoAccesses.length,
      timestamp: now.toISOString()
    };

    console.log('✅ Demo access check completed:', stats);

    return NextResponse.json({
      success: true,
      message: `Processed ${processedCount} expired demo accesses`,
      stats
    });

  } catch (error) {
    console.error('❌ Error in demo access check:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Функция для удаления пользователя из канала (такая же как в подписках)
async function removeUserFromChannel(userId: string, channelId: string, botToken: string): Promise<void> {
  try {
    // Проверка, состоит ли пользователь в канале
    const chatMemberResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          user_id: userId
        })
      }
    );

    const chatMemberData = await chatMemberResponse.json();

    if (chatMemberData.ok) {
      const status = chatMemberData.result.status;

      // Если пользователь состоит в канале (не left/kicked), пытаемся его удалить
      if (status !== 'left' && status !== 'kicked') {
        // Для каналов нужно использовать ban/unban, так как прямого удаления нет
        // Сначала баним, потом разбаним (это удалит пользователя из канала)
        await fetch(
          `https://api.telegram.org/bot${botToken}/banChatMember`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channelId,
              user_id: userId,
              revoke_messages: false
            })
          }
        );

        // Сразу разбаниваем (чтобы пользователь мог снова войти при покупке подписки)
        await fetch(
          `https://api.telegram.org/bot${botToken}/unbanChatMember`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channelId,
              user_id: userId,
              only_if_banned: true
            })
          }
        );
      }
    }
  } catch (error) {
    console.error(`Error removing user ${userId} from channel ${channelId}:`, error);
    throw error;
  }
}

// Функция для отправки уведомлений о приближающемся окончании демо-доступа
async function sendDemoExpirationReminders(): Promise<void> {
  try {
    const now = new Date();

    // Находим демо-доступы, которые истекают через 1 день
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const oneDayExpiring = await prisma.demoAccess.findMany({
      where: {
        isActive: true,
        expiresAt: {
          gte: oneDayFromNow,
          lt: twoDaysFromNow // Истекают в течение следующих 24 часов
        }
      },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            username: true
          }
        },
        product: {
          select: {
            name: true,
            channel: {
              select: {
                channelId: true,
                name: true,
                username: true
              }
            }
          }
        }
      }
    });

    if (oneDayExpiring.length === 0) {
      console.log('📅 No demo access expiring in 1 day');
      return;
    }

    console.log(`⏰ Found ${oneDayExpiring.length} demo accesses expiring in 1 day`);

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      console.error('BOT_TOKEN not configured for sending demo reminders');
      return;
    }

    for (const demo of oneDayExpiring) {
      try {
        const expiresDate = new Date(demo.expiresAt).toLocaleDateString('ru-RU');
        const channelUsername = demo.product.channel.username
          ? `@${demo.product.channel.username}`
          : demo.product.channel.name;

        const message = `
⚠️ *Ваш демо-доступ истекает через 1 день!*

📦 *Продукт:* ${demo.product.name}
📢 *Канал:* ${demo.product.channel.name}
📅 *Дата окончания:* ${expiresDate}

❗ *Последний день для оформления подписки!*

Чтобы сохранить доступ к закрытому контенту, подпишитесь на канал:

1. Нажмите кнопку "Подписаться" ниже
2. Выберите подходящий тариф
3. Оплатите подписку

Продлите доступ сейчас, чтобы не потерять возможность изучать наш контент! 💙
        `.trim();

        await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: demo.user.telegramId.toString(),
              text: message,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: '🛍️ Подписаться',
                      web_app: {
                        url: `${process.env.APP_URL?.replace(/\n/g, '')}/app`
                      }
                    }
                  ],
                  [
                    {
                      text: '📢 Перейти в канал',
                      url: `https://t.me/${demo.product.channel.username?.replace('@', '')}`
                    }
                  ]
                ]
              }
            })
          }
        );

        console.log(`⏰ Sent 1-day demo reminder to user ${demo.user.telegramId}`);

        // Небольшая задержка между отправками
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error sending 1-day demo reminder to user ${demo.user.telegramId}:`, error);
      }
    }

  } catch (error) {
    console.error('Error sending demo expiration reminders:', error);
  }
}

// Функция для отправки уведомления об окончании демо (аналогично подпискам)
async function sendDemoExpirationNotification(
  userId: string,
  productName: string,
  channelName: string,
  botToken: string
): Promise<void> {
  try {
    const message = `
📋 *Ваш демо-доступ завершен*

📦 *Продукт:* ${productName}
📢 *Канал:* ${channelName}

Ваш бесплатный демо-период закончился.
Вы больше не имеете доступа к закрытому контенту.

🛍️ *Чтобы продолжить доступ:*
Нажмите кнопку ниже и выберите подходящий тариф.
    `.trim()

    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: userId,
          text: message,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🛍️ Управление подписками',
                  web_app: {
                    url: `${process.env.APP_URL?.replace(/\n/g, '')}/app`
                  }
                }
              ]
            ]
          }
        })
      }
    )
  } catch (error) {
    console.error(`Error sending demo expiration notification to user ${userId}:`, error);
    throw error;
  }
}

// GET для проверки статуса
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'Demo access monitoring endpoint',
    description: 'This endpoint checks and manages demo access periods',
    usage: 'POST with Authorization: Bearer CRON_SECRET (optional)'
  });
}