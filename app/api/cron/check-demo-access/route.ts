import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Ключ для защиты cron endpoint
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key'

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию cron запроса
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.log('❌ Invalid cron authorization');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 Starting demo access check...');

    const now = new Date();
    console.log(`📅 Current time: ${now.toISOString()}`);

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
          continue;
        }

        // Удаляем пользователя из канала через Telegram Bot API
        await removeUserFromChannel(
          demo.user.telegramId,
          demo.product.channel.channelId,
          demo.product.name
        );

        // Обновляем статус демо-доступа
        await prisma.demoAccess.update({
          where: { id: demo.id },
          data: { isActive: false }
        });

        console.log(`✅ Successfully processed expired demo: ${demo.id}`);

      } catch (error) {
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
        await addUserToChannel(
          demo.user.telegramId,
          demo.product.channel.channelId,
          demo.product.name
        );

      } catch (error) {
        console.error(`❌ Error processing active demo ${demo.id}:`, error);
      }
    }

    const stats = {
      processed: expiredDemoAccesses.length,
      active: activeDemoAccesses.length,
      timestamp: now.toISOString()
    };

    console.log('✅ Demo access check completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Demo access check completed',
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

// Функция для добавления пользователя в канал
async function addUserToChannel(userTelegramId: BigInt, channelId: BigInt, productName: string) {
  try {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      throw new Error('Bot token not configured');
    }

    // Добавляем пользователя в канал
    const addResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/chatMember?chat_id=@${channelId}&user_id=${userTelegramId}`
    );

    const addResult = await addResponse.json();
    console.log('🔍 Add to channel response:', addResult);

    if (addResult.ok) {
      const member = addResult.result;
      if (member.status === 'left' || member.status === 'kicked') {
        // Если пользователь не в канале, пытаемся добавить
        const inviteResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/createChatInviteLink?chat_id=@${channelId}&member_limit=1&name=Demo%20Access%20Invite`
        );

        const inviteResult = await inviteResponse.json();
        if (inviteResult.ok) {
          console.log(`✅ Created invite link for user ${userTelegramId} to channel ${channelId}`);
          // В реальном приложении здесь нужно отправить пользователю ссылку-приглашение
        }
      } else {
        console.log(`✅ User ${userTelegramId} already has access to channel ${channelId}`);
      }
    } else {
      console.error(`❌ Error checking user status: ${addResult.description}`);
    }

  } catch (error) {
    console.error('❌ Error adding user to channel:', error);
    throw error;
  }
}

// Функция для удаления пользователя из канала
async function removeUserFromChannel(userTelegramId: BigInt, channelId: BigInt, productName: string) {
  try {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      throw new Error('Bot token not configured');
    }

    // Удаляем пользователя из канала
    const kickResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/kickChatMember?chat_id=@${channelId}&user_id=${userTelegramId}`,
      {
        method: 'POST'
      }
    );

    const kickResult = await kickResponse.json();
    console.log('🔍 Kick from channel response:', kickResult);

    if (kickResult.ok) {
      console.log(`✅ Successfully removed user ${userTelegramId} from channel ${channelId}`);

      // Отправляем сообщение пользователю о завершении демо-периода
      const messageResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${userTelegramId}&text=${encodeURIComponent(
          `📋 Ваш демо-доступ завершен!

📦 Продукт: ${productName}
📅 Демо-период: ${new Date().toLocaleDateString('ru-RU')}

Для продолжения доступа к каналу оформите полную подписку в приложении.

💳 Оформить подписку можно в нашем Telegram Mini App
`
        )}&parse_mode=HTML`
      );

      const messageResult = await messageResponse.json();
      if (messageResult.ok) {
        console.log(`✅ Sent notification to user ${userTelegramId}`);
      } else {
        console.error(`❌ Error sending notification: ${messageResult.description}`);
      }

    } else {
      console.error(`❌ Error kicking user from channel: ${kickResult.description}`);

      // Если не удалось удалить из канала, все равно сообщаем пользователю
      const messageResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${userTelegramId}&text=${encodeURIComponent(
          `📋 Ваш демо-доступ завершен!

📦 Продукт: ${productName}
📅 Демо-период: ${new Date().toLocaleDateString('ru-RU')}

Для продолжения доступа к каналу оформите полную подписку в приложении.

💳 Оформить подписку можно в нашем Telegram Mini App
`
        )}&parse_mode=HTML`
      );

      const messageResult = await messageResponse.json();
      if (messageResult.ok) {
        console.log(`✅ Sent notification to user ${userTelegramId}`);
      }
    }

  } catch (error) {
    console.error('❌ Error removing user from channel:', error);
    // Не бросаем ошибку, чтобы не прерывать обработку других демо-доступов
  }
}

// GET для проверки статуса
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'Demo access monitoring endpoint',
    description: 'This endpoint checks and manages demo access periods',
    usage: 'POST with Authorization: Bearer CRON_SECRET'
  });
}