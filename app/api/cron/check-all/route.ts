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

    console.log('🔄 Starting combined subscription and demo access check...');
    const now = new Date();
    console.log(`📅 Current time: ${now.toISOString()}`);

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      throw new Error('BOT_TOKEN not configured');
    }

    let totalProcessed = 0
    let subscriptionProcessed = 0
    let demoProcessed = 0
    let errorCount = 0

    // === ЧАСТЬ 1: Проверка подписок ===
    console.log('🔍 Checking subscriptions...');

    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
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

    console.log(`🔍 Found ${expiredSubscriptions.length} expired subscriptions`);

    for (const subscription of expiredSubscriptions) {
      try {
        console.log(`🗑️ Processing expired subscription: ${subscription.subscriptionId}`);

        // Проверяем, что продукт и канал существуют
        if (!subscription.product || !subscription.product.channel) {
          console.warn(`⚠️ Skipping subscription ${subscription.subscriptionId}: missing product or channel data`);
          continue;
        }

        // Удаляем пользователя из канала
        await removeUserFromChannel(
          subscription.user.telegramId.toString(),
          subscription.product.channel.channelId.toString(),
          botToken
        );

        // Отправляем уведомление
        await sendSubscriptionExpirationNotification(
          subscription.user.telegramId.toString(),
          subscription.product.name,
          subscription.product.channel.name,
          botToken
        );

        // Обновляем статус подписки
        await prisma.subscription.update({
          where: { subscriptionId: subscription.subscriptionId },
          data: { status: 'expired' }
        });

        subscriptionProcessed++;
        totalProcessed++;
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing subscription ${subscription.subscriptionId}:`, error);
      }
    }

    // === ЧАСТЬ 2: Проверка демо-доступов ===
    console.log('🔍 Checking demo access...');

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

        // Проверяем, что продукт и канал существуют
        if (!demo.product || !demo.product.channel) {
          console.warn(`⚠️ Skipping demo ${demo.id}: missing product or channel data`);
          continue;
        }

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
          demoProcessed++;
          totalProcessed++;
          continue;
        }

        // Удаляем пользователя из канала
        await removeUserFromChannel(
          demo.user.telegramId.toString(),
          demo.product.channel.channelId.toString(),
          botToken
        );

        // Отправляем уведомление
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

        demoProcessed++;
        totalProcessed++;
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing demo ${demo.id}:`, error);
      }
    }

    const stats = {
      timestamp: now.toISOString(),
      subscriptions: {
        processed: subscriptionProcessed,
        totalFound: expiredSubscriptions.length
      },
      demoAccess: {
        processed: demoProcessed,
        totalFound: expiredDemoAccesses.length
      },
      total: {
        processed: totalProcessed,
        errors: errorCount
      }
    };

    console.log('✅ Combined check completed:', stats);

    return NextResponse.json({
      success: true,
      message: `Processed ${totalProcessed} expired accesses (${subscriptionProcessed} subscriptions, ${demoProcessed} demo accesses)`,
      stats
    });

  } catch (error) {
    console.error('❌ Error in combined check:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Функция для удаления пользователя из канала
async function removeUserFromChannel(userId: string, channelId: string, botToken: string): Promise<void> {
  try {
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

      if (status !== 'left' && status !== 'kicked') {
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

// Функция для отправки уведомления об окончании подписки
async function sendSubscriptionExpirationNotification(
  userId: string,
  productName: string,
  channelName: string,
  botToken: string
): Promise<void> {
  try {
    const message = `
📋 *Ваша подписка завершена*

📦 *Продукт:* ${productName}
📢 *Канал:* ${channelName}

Срок действия вашей подписки истёк.
Вы больше не имеете доступа к закрытому контенту.

🛍️ *Чтобы продолжить доступ:*
Нажмите кнопку ниже и выберите подходящий тариф.
    `.trim();

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
    console.error(`Error sending subscription expiration notification to user ${userId}:`, error);
    throw error;
  }
}

// Функция для отправки уведомления об окончании демо
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
    `.trim();

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
    status: 'Combined subscription and demo access monitoring endpoint',
    description: 'This endpoint checks both expired subscriptions and demo accesses',
    usage: 'POST with Authorization: Bearer CRON_SECRET (optional)',
    schedule: 'Runs daily at 3:00 AM UTC'
  });
}