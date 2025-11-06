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

export async function GET() {
  try {
    console.log('🧪 Testing products-v2 API with BigInt serialization...');

    // Тестовые данные с BigInt
    const testResponse = {
      success: true,
      message: 'BigInt serialization working',
      testData: {
        productId: BigInt(123456789),
        channelId: BigInt(987654321),
        price: 10.50,
        periodDays: 30,
        isActive: true
      }
    };

    console.log('✅ Test data:', safeStringify(testResponse));

    return NextResponse.json(testResponse, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}