import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'

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

// Функция для проверки админ прав
async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  try {
    const initData = request.headers.get('x-telegram-init-data');

    if (!initData) {
      return false
    }

    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      return false
    }

    const urlParams = new URLSearchParams(initData)
    const userStr = urlParams.get('user')

    if (!userStr) {
      return false
    }

    const user = JSON.parse(decodeURIComponent(userStr))
    const telegramId = BigInt(user.id)

    const admin = await prisma.admin.findUnique({
      where: { telegramId }
    })

    return !!admin
  } catch (error) {
    console.error('Auth error:', error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAdminAuth(request))) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { userId, productId, demoDays } = body

    if (!userId || !productId || !demoDays) {
      return createJsonResponse(
        { error: 'Missing required fields' },
        400
      )
    }

    console.log('🔍 Granting demo access with data:', {
      userId,
      userIdType: typeof userId,
      productId,
      productIdType: typeof productId,
      demoDays
    })

    // Корректно преобразуем userId в BigInt
    let userIdBigInt: bigint
    try {
      userIdBigInt = BigInt(userId)
    } catch (error) {
      console.error('❌ Invalid userId format:', userId, error)
      return createJsonResponse(
        { error: 'Invalid userId format', details: `Cannot convert userId "${userId}" to BigInt` },
        400
      )
    }

    // Проверяем, что существует пользователь
    let user = await prisma.user.findUnique({
      where: { telegramId: userIdBigInt }
    })

    if (!user) {
      // Создаем пользователя если его нет
      user = await prisma.user.create({
        data: {
          telegramId: userIdBigInt,
          firstName: 'Demo User',
        }
      })
    }

    // Проверяем, что продукт существует и поддерживает демо
    const product = await prisma.product.findUnique({
      where: { productId },
      include: {
        channel: true
      }
    })

    if (!product) {
      return createJsonResponse(
        { error: 'Product not found' },
        404
      )
    }

    if (!product.allowDemo) {
      return createJsonResponse(
        { error: 'Product does not support demo access' },
        400
      )
    }

    // Проверяем, есть ли уже активный демо-доступ
    const existingDemoAccess = await prisma.demoAccess.findFirst({
      where: {
        userId: userIdBigInt,
        productId: productId,
        isActive: true
      }
    })

    if (existingDemoAccess) {
      return createJsonResponse(
        { error: 'User already has an active demo access for this product' },
        400
      )
    }

    // Создаем демо-доступ
    const now = new Date()
    const expiresAt = new Date(now.getTime() + demoDays * 24 * 60 * 60 * 1000)

    const demoAccess = await prisma.demoAccess.create({
      data: {
        userId: userIdBigInt,
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
            price: true
          }
        }
      }
    })

    console.log('🔍 Demo access granted successfully:', demoAccess.id)

    // Добавляем пользователя в канал через Telegram Bot API
    if (product.channel) {
      try {
        await addUserToChannel(userIdBigInt, product.channel.channelId, product.name);
        console.log('✅ User added to channel successfully');
      } catch (error) {
        console.error('❌ Error adding user to channel:', error);
        // Не прерываем процесс, если не удалось добавить в канал
      }
    } else {
      console.warn('⚠️ Product has no channel assigned, skipping channel add');
    }

    // Конвертируем BigInt в string
    const serializedDemoAccess = {
      id: demoAccess.id,
      userId: demoAccess.userId.toString(),
      productId: demoAccess.productId,
      startedAt: demoAccess.startedAt.toISOString(),
      expiresAt: demoAccess.expiresAt.toISOString(),
      isActive: demoAccess.isActive,
      user: demoAccess.user,
      product: demoAccess.product
    }

    return createJsonResponse({ demoAccess: serializedDemoAccess })

  } catch (error) {
    console.error('Error granting demo access:', error)
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
async function addUserToChannel(userTelegramId: bigint, channelId: bigint, productName: string) {
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
            text: `🎉 *Вам выдан демо-доступ!*\n\n📦 *Продукт:* ${productName}\n📅 *Ваш демо-период начался!*\n\n🔗 *Ссылка для входа в канал:*\n${inviteLink}\n\nНажмите на ссылку выше, чтобы присоединиться к каналу.\n\n✅ *Внимание:* Ссылка постоянная и действительна всегда!`,
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
                                            url: `${process.env.APP_URL?.trim().replace(/[\n\r\t]/g, '')}/app`                    }
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
            text: `🎉 *Вам выдан демо-доступ!*\n\n📦 *Продукт:* ${productName}\n📅 *Ваш демо-период начался!*\n\nℹ️ Для доступа к каналу, пожалуйста, свяжитесь с администратором.`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '📱 Открыть Mini App',
                    web_app: {
                                            url: `${process.env.APP_URL?.trim().replace(/[\n\r\t]/g, '')}/app`                    }
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
