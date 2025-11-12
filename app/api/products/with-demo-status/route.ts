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

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 PRODUCTS WITH DEMO: Starting fetch...');

    // Проверяем авторизацию пользователя
    const auth = await checkUserAuth(request);
    if (!auth) {
      return createJsonResponse(
        { error: 'Unauthorized' },
        401
      )
    }

    const { telegramId } = auth;
    console.log('✅ User authenticated:', telegramId.toString());

    // Получаем все активные продукты
    const products = await prisma.product.findMany({
      where: {
        isActive: true
      },
      include: {
        channel: {
          select: {
            channelId: true,
            name: true,
            username: true
          }
        },
        discounts: {
          where: {
            isActive: true,
            startDate: {
              lte: new Date()
            },
            endDate: {
              gte: new Date()
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Получаем все демо-доступы пользователя для проверки
    const userDemoAccesses = await prisma.demoAccess.findMany({
      where: {
        userId: telegramId as bigint
      },
      select: {
        productId: true,
        isActive: true,
        startedAt: true,
        expiresAt: true
      }
    });

    // Получаем все подписки пользователя
    const userSubscriptions = await prisma.subscription.findMany({
      where: {
        userId: telegramId as bigint,
        status: 'active',
        expiresAt: {
          gt: new Date()
        }
      },
      select: {
        productId: true
      }
    });

    console.log(`🔍 Found ${products.length} products, ${userDemoAccesses.length} demo accesses, ${userSubscriptions.length} subscriptions`);

    // Создаем множества для быстрой проверки
    const demoProductIds = new Set(userDemoAccesses.map(da => da.productId));
    const subscriptionProductIds = new Set(userSubscriptions.map(s => s.productId));
    const activeDemoProductIds = new Set(
      userDemoAccesses
        .filter(da => da.isActive && da.expiresAt > new Date())
        .map(da => da.productId)
    );

    // Применяем логику скидок и добавляем статус демо к каждому продукту
    const productsWithDiscountsAndDemo = products.map(product => {
      let finalPrice = parseFloat(product.price.toString());
      let discountPrice = product.discountPrice ? parseFloat(product.discountPrice.toString()) : null;
      let activeDiscount = null;

      // Если у продукта есть постоянная скидка (discountPrice), используем её
      if (discountPrice && discountPrice < finalPrice) {
        finalPrice = discountPrice;
      }

      // Проверяем временные скидки
      if (product.discounts && product.discounts.length > 0) {
        const tempDiscount = product.discounts[0]; // Берем последнюю активную скидку
        const calculatedDiscountPrice = calculateDiscountPrice(
          parseFloat(product.price.toString()),
          tempDiscount.type,
          parseFloat(tempDiscount.value.toString())
        );

        // Если временная скидка лучше, чем текущая цена, применяем её
        if (calculatedDiscountPrice < finalPrice) {
          finalPrice = calculatedDiscountPrice;
          activeDiscount = {
            type: tempDiscount.type,
            value: parseFloat(tempDiscount.value.toString()),
            endDate: tempDiscount.endDate
          };
        }
      }

      // Определяем статус демо-доступа для этого продукта
      const hasDemoAccess = demoProductIds.has(product.productId);
      const hasActiveDemo = activeDemoProductIds.has(product.productId);
      const hasSubscription = subscriptionProductIds.has(product.productId);

      // Находим соответствующий демо-доступ для получения детальной информации
      const userDemoAccess = userDemoAccesses.find(da => da.productId === product.productId);
      const demoAccessInfo = userDemoAccess ? {
        isActive: userDemoAccess.isActive,
        startedAt: userDemoAccess.startedAt.toISOString(),
        expiresAt: userDemoAccess.expiresAt.toISOString(),
        daysRemaining: Math.ceil((userDemoAccess.expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      } : null;

      return {
        productId: product.productId.toString(),
        name: product.name,
        description: product.description,
        price: parseFloat(product.price.toString()),
        discountPrice: finalPrice < parseFloat(product.price.toString()) ? finalPrice : null,
        originalDiscountPrice: discountPrice, // Для информации о постоянной скидке
        periodDays: product.periodDays,
        isTrial: product.isTrial,
        isActive: product.isActive,
        allowDemo: product.allowDemo && !hasDemoAccess && !hasSubscription, // Блокируем демо если уже использовали или есть подписка
        demoDays: product.demoDays,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        activeDiscount, // Информация о временной скидке
        demoStatus: {
          hasUsed: hasDemoAccess,
          isActive: hasActiveDemo,
          hasSubscription,
          demoAccess: demoAccessInfo
        },
        channel: product.channel ? {
          channelId: product.channel.channelId.toString(),
          name: product.channel.name,
          username: product.channel.username
        } : null
      };
    });

    console.log('✅ PRODUCTS WITH DEMO: Successfully processed products');

    return new NextResponse(safeStringify({
      success: true,
      data: productsWithDiscountsAndDemo
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('❌ Error in products with demo status fetch:', error);
    return new NextResponse(safeStringify({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// Функция для расчета цены со скидкой
function calculateDiscountPrice(originalPrice: number, discountType: 'PERCENTAGE' | 'FIXED_AMOUNT', discountValue: number): number {
  if (discountType === 'PERCENTAGE') {
    return Math.max(0, originalPrice * (1 - discountValue / 100));
  } else {
    return Math.max(0, originalPrice - discountValue);
  }
}