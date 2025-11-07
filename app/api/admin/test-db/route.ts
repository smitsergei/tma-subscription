import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    console.log('🔍 Testing database connection...');

    // Простой запрос без BigInt
    const userCount = await prisma.user.count();
    console.log('✅ Users count:', userCount);

    const adminCount = await prisma.admin.count();
    console.log('✅ Admins count:', adminCount);

    const subscriptionCount = await prisma.subscription.count();
    console.log('✅ Subscriptions count:', subscriptionCount);

    const productCount = await prisma.product.count();
    console.log('✅ Products count:', productCount);

    return NextResponse.json({
      success: true,
      counts: {
        users: userCount,
        admins: adminCount,
        subscriptions: subscriptionCount,
        products: productCount
      }
    });

  } catch (error) {
    console.error('❌ Database test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Database connection error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}