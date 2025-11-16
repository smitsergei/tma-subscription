import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'
import { notifyAdminsAboutDemoAccess } from '@/lib/adminNotifications'

export const dynamic = 'force-dynamic'

// Утилита для безопасной сериализации BigInt
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}

// Функция для создания аутентифицированного ответа
function createJsonResponse(data: any, status: number = 200): NextResponse {
  return new NextResponse(safeStringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// Функция для проверки авторизации пользователя
async function checkUserAuth(request: NextRequest): Promise<{ user: any; telegramId: BigInt } | null> {
  try {
    const initData = request.headers.get('x-telegram-init-data');

    // Также проверяем в query params для совместимости
    const url = new URL(request.url);
    const queryData = url.searchParams.get('initData');
    const webAppData = url.searchParams.get('tgWebAppData');

    const authData = initData || queryData || webAppData;

    if (!authData) {
      console.log('❌ No init data found in headers or query');
      return null;
    }

    console.log('🔍 Validating init data...');

    if (!validateTelegramInitData(authData, process.env.BOT_TOKEN!)) {
      console.log('❌ Invalid init data signature');
      return null;
    }

    console.log('✅ Init data signature valid');

    // Для tgWebAppData нужно распарсить по-другому
    let userStr: string | null = null;

    if (authData.includes('user=')) {
      const urlParams = new URLSearchParams(authData);
      userStr = urlParams.get('user');
    } else if (authData.includes('tgWebAppData=')) {
      const cleanData = authData.replace('tgWebAppData=', '');
      const urlParams = new URLSearchParams(cleanData);
      userStr = urlParams.get('user');
    }

    if (!userStr) {
      console.log('❌ No user data found in init data');
      return null;
    }

    console.log('🔍 User data found, parsing...');

    const user = JSON.parse(decodeURIComponent(userStr));
    const telegramId = BigInt(user.id);

    console.log('✅ User parsed successfully:', { telegramId: telegramId.toString(), firstName: user.first_name });

    // Проверяем или создаем пользователя
    let dbUser = await prisma.user.findUnique({
      where: { telegramId }
    })

    if (!dbUser) {
      console.log('🔍 User not found in DB, creating new user...');
      dbUser = await prisma.user.create({
        data: {
          telegramId,
          firstName: user.first_name || 'User',
          username: user.username || null,
        }
      })
      console.log('✅ New user created successfully');
    }

    return { user: dbUser, telegramId }
  } catch (error) {
    console.error('❌ Auth error:', error);
    return null;
  }
}

// POST - Запрос демо-доступа для продукта
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting demo access request...');

    // Проверяем авторизацию пользователя
    const auth = await checkUserAuth(request);
    if (!auth) {
      return createJsonResponse(
        { error: 'Unauthorized' },
        401
      )
    }

    const { user, telegramId } = auth;

    // Получаем productId из тела запроса
    const body = await request.json();
    const { productId } = body;

    if (!productId) {
      return createJsonResponse(
        { error: 'Product ID is required' },
        400
      )
    }

    console.log('🔍 Processing demo request:', {
      telegramId: telegramId.toString(),
      productId
    });

    // Проверяем, что продукт существует и поддерживает демо
    const product = await prisma.product.findUnique({
      where: { productId },
      include: {
        channel: {
          select: {
            channelId: true,
            name: true
          }
        }
      }
    });

    if (!product) {
      return createJsonResponse(
        { error: 'Product not found' },
        404
      )
    }

    if (!product.allowDemo) {
      return createJsonResponse(
        { error: 'This product does not support demo access' },
        400
      )
    }

    if (!product.isActive) {
      return createJsonResponse(
        { error: 'This product is not currently available' },
        400
      )
    }

    console.log('✅ Product validated for demo access:', {
      name: product.name,
      demoDays: product.demoDays,
      channelName: product.channel.name
    });

    // Проверяем, есть ли уже активный демо-доступ
    const existingDemoAccess = await prisma.demoAccess.findFirst({
      where: {
        userId: telegramId as bigint,
        productId: productId,
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (existingDemoAccess) {
      const daysLeft = Math.ceil((existingDemoAccess.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return createJsonResponse(
        {
          error: 'You already have an active demo access for this product',
          demoAccess: {
            id: existingDemoAccess.id,
            startedAt: existingDemoAccess.startedAt.toISOString(),
            expiresAt: existingDemoAccess.expiresAt.toISOString(),
            daysLeft
          }
        },
        400
      )
    }

    // Проверяем, использовал ли пользователь демо-доступ для этого продукта ранее
    const previousDemoAccess = await prisma.demoAccess.findFirst({
      where: {
        userId: telegramId as bigint,
        productId: productId
      },
      orderBy: {
        startedAt: 'desc'
      }
    });

    if (previousDemoAccess) {
      console.log('🔍 User has previous demo access:', {
        userId: telegramId.toString(),
        productId: productId,
        startedAt: previousDemoAccess.startedAt.toISOString(),
        isActive: previousDemoAccess.isActive,
        expiresAt: previousDemoAccess.expiresAt.toISOString()
      });

      return createJsonResponse(
        {
          error: 'You have already used demo access for this product',
          demoAccess: {
            id: previousDemoAccess.id,
            startedAt: previousDemoAccess.startedAt.toISOString(),
            expiresAt: previousDemoAccess.expiresAt.toISOString(),
            isActive: previousDemoAccess.isActive,
            wasUsed: true
          }
        },
        400
      )
    }

    // Проверяем, есть ли активная платная подписка
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: telegramId as bigint,
        productId: productId,
        status: 'active',
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (existingSubscription) {
      return createJsonResponse(
        { error: 'You already have an active subscription for this product' },
        400
      )
    }

    console.log('🔍 Creating demo access...');

    // Создаем демо-доступ
    const now = new Date();
    const expiresAt = new Date(now.getTime() + product.demoDays * 24 * 60 * 60 * 1000);

    const demoAccess = await prisma.demoAccess.create({
      data: {
        userId: telegramId as bigint,
        productId,
        startedAt: now,
        expiresAt,
        isActive: true
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
            price: true,
            demoDays: true,
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

    console.log('✅ Demo access created successfully:', {
      id: demoAccess.id,
      userId: demoAccess.userId.toString(),
      productId: demoAccess.productId,
      expiresAt: demoAccess.expiresAt.toISOString()
    });

    // Отправляем уведомление администраторам
    try {
      await notifyAdminsAboutDemoAccess(
        {
          telegramId: telegramId.toString(),
          firstName: user.firstName,
          username: user.username || undefined
        },
        {
          name: product.name,
          periodDays: product.demoDays,
          channelName: product.channel.name
        },
        {
          demoDays: product.demoDays
        }
      )
    } catch (error) {
      console.error('❌ DEMO: Error sending admin notification:', error)
      // Не прерываем процесс при ошибке уведомления
    }

    // Добавляем пользователя в канал через Telegram Bot API
    try {
      await addUserToChannel(telegramId, demoAccess.product.channel.channelId, product.name);
      console.log('✅ User added to channel successfully');
    } catch (error) {
      console.error('❌ Error adding user to channel:', error);
      // Не прерываем процесс, если не удалось добавить в канал
    }

    // Конвертируем BigInt в string
    const serializedDemoAccess = {
      id: demoAccess.id,
      userId: demoAccess.userId.toString(),
      productId: demoAccess.productId,
      startedAt: demoAccess.startedAt.toISOString(),
      expiresAt: demoAccess.expiresAt.toISOString(),
      isActive: demoAccess.isActive,
      daysRemaining: Math.ceil((demoAccess.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      user: {
        ...demoAccess.user,
        telegramId: demoAccess.user.telegramId.toString()
      },
      product: {
        ...demoAccess.product,
        price: parseFloat(demoAccess.product.price.toString()),
        channel: {
          ...demoAccess.product.channel,
          channelId: demoAccess.product.channel.channelId.toString()
        }
      }
    };

    return createJsonResponse({
      success: true,
      demoAccess: serializedDemoAccess,
      message: `Демо-доступ успешно оформлен на ${product.demoDays} дней! Вы добавлены в канал.`
    });

  } catch (error) {
    console.error('❌ Error requesting demo access:', error);
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

// GET - Получение демо-доступов текущего пользователя
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching user demo accesses...');

    // Проверяем авторизацию пользователя
    const auth = await checkUserAuth(request);
    if (!auth) {
      return createJsonResponse(
        { error: 'Unauthorized' },
        401
      )
    }

    const { telegramId } = auth;

    // Получаем демо-доступы пользователя
    const demoAccesses = await prisma.demoAccess.findMany({
      where: {
        userId: telegramId as bigint
      },
      include: {
        product: {
          select: {
            productId: true,
            name: true,
            price: true,
            demoDays: true,
            channel: {
              select: {
                channelId: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        startedAt: 'desc'
      }
    });

    const now = new Date();

    // Конвертируем BigInt в string и добавляем статус
    const serializedDemoAccesses = demoAccesses.map(demo => {
      const isExpired = demo.expiresAt < now;
      const daysRemaining = Math.ceil((demo.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isCurrentlyActive = demo.isActive && !isExpired;

      return {
        id: demo.id,
        userId: demo.userId.toString(),
        productId: demo.productId,
        startedAt: demo.startedAt.toISOString(),
        expiresAt: demo.expiresAt.toISOString(),
        isActive: demo.isActive,
        isExpired,
        isCurrentlyActive,
        daysRemaining: Math.max(0, daysRemaining),
        product: {
          ...demo.product,
          price: parseFloat(demo.product.price.toString()),
          channel: {
            ...demo.product.channel,
            channelId: demo.product.channel.channelId.toString()
          }
        }
      }
    });

    // Разделяем на активные и истекшие
    const activeDemoAccesses = serializedDemoAccesses.filter(demo => demo.isCurrentlyActive);
    const expiredDemoAccesses = serializedDemoAccesses.filter(demo => !demo.isCurrentlyActive);

    return createJsonResponse({
      success: true,
      demoAccesses: {
        active: activeDemoAccesses,
        expired: expiredDemoAccesses,
        all: serializedDemoAccesses
      },
      stats: {
        total: serializedDemoAccesses.length,
        active: activeDemoAccesses.length,
        expired: expiredDemoAccesses.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching demo accesses:', error);
    return createJsonResponse(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}
// Функция для добавления пользователя в канал
async function addUserToChannel(userTelegramId: BigInt, channelId: BigInt, productName: string) {
  try {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      throw new Error('Bot token not configured');
    }

    // Сначала пробуем найти существующую демо-ссылку
    let inviteLink = null;

    try {
      const existingInvitesResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/getChatInviteLinks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: channelId.toString()
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
          inviteLink = existingInvite.invite_link;
          console.log('🔍 Found existing demo invite link:', inviteLink);
        }
      }
    } catch (error) {
      console.log('🔍 Could not check existing demo invites, creating new one:', error);
    }

    // Если нет существующей ссылки, создаем новую
    if (!inviteLink) {
      console.log('🔍 Creating new demo invite link...');
      const inviteResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: channelId.toString(),
            name: 'Demo Access Invite',
            member_limit: 1
            // Убрали expire_date, чтобы ссылка была постоянной
          })
        }
      );

      const inviteResult = await inviteResponse.json();
      console.log('🔍 Create demo invite link response:', inviteResult);

      if (inviteResult.ok) {
        inviteLink = inviteResult.result.invite_link;
        console.log('🔍 Created new demo invite link:', inviteLink);
      } else {
        throw new Error(`Failed to create demo invite link: ${inviteResult.description}`);
      }
    }

    if (inviteLink) {
      // Отправляем пользователю сообщение со ссылкой-приглашением
      const messageResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userTelegramId.toString(),
            text: `🎉 *Демо-доступ активирован!*

📦 *Продукт:* ${productName}
📅 *Ваш демо-период начался!*

🔗 *Ссылка для входа в канал:*
${inviteLink}

Нажмите на ссылку выше, чтобы присоединиться к каналу.

✅ *Внимание:* Ссылка постоянная и действительна всегда!`,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🚀 Открыть канал',
                    url: inviteLink
                  }
                ],
                [
                  {
                    text: '📱 Открыть Mini App',
                    web_app: {
                      url: `${process.env.APP_URL?.trim().replace(/[\n\r\t]/g, '')}/app`
                    }
                  }
                ]
              ]
            }
          })
        }
      );

      const messageResult = await messageResponse.json();
      if (messageResult.ok) {
        console.log(`✅ Sent demo access message to user ${userTelegramId}`);
      } else {
        console.error(`❌ Error sending message: ${messageResult.description}`);
      }

    } else {
      console.error(`❌ No invite link available for demo access`);

      // Если не удалось создать ссылку, отправляем базовое сообщение
      const fallbackResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userTelegramId.toString(),
            text: `🎉 *Демо-доступ активирован!*

📦 *Продукт:* ${productName}
📅 *Ваш демо-период начался!*

ℹ️ Для доступа к каналу, пожалуйста, свяжитесь с администратором.`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '📱 Открыть Mini App',
                    web_app: {
                      url: `${process.env.APP_URL?.trim().replace(/[\n\r\t]/g, '')}/app`
                    }
                  }
                ]
              ]
            }
          })
        }
      );

      const fallbackResult = await fallbackResponse.json();
      if (fallbackResult.ok) {
        console.log(`✅ Sent fallback message to user ${userTelegramId}`);
      }
    }

  } catch (error) {
    console.error('❌ Error adding user to channel:', error);
    throw error;
  }
}
