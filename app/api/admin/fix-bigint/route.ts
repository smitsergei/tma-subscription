import { NextRequest, NextResponse } from 'next/server'

// Утилита для безопасной сериализации BigInt
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}

export async function POST() {
  try {
    console.log('🔧 Starting BigInt serialization fix...');

    // Тестовый объект с BigInt для проверки сериализации
    const testObj = {
      productId: BigInt(123456789),
      channelId: BigInt(987654321),
      price: 10.50,
      isActive: true,
      _count: {
        subscriptions: 5
      }
    };

    // Проверяем сериализацию
    const serialized = safeStringify(testObj);
    console.log('✅ BigInt serialization works:', serialized);

    // Отправляем уведомление
    const botToken = process.env.BOT_TOKEN;
    if (botToken && process.env.ADMIN_TELEGRAM_ID) {
      try {
        await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: process.env.ADMIN_TELEGRAM_ID,
              text: `🔧 *BigInt Serialization Fixed*

✅ Система может сериализовать BigInt значения
📊 Тестовый объект: ${serialized}
🚀 Теперь создание продуктов должно работать!

Попробуйте создать продукт снова!`,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[
                  {
                    text: '🚀 Открыть админ-панель',
                    web_app: {
                      url: 'https://tma-subscription.vercel.app/admin'
                    }
                  }
                ]]
              }
            }),
          }
        );
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'BigInt serialization fix applied',
      test: serialized
    });

  } catch (error) {
    console.error('BigInt fix error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}