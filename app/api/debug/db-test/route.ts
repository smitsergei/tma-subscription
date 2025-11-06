import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 DB TEST: Testing database connection...')

    // Test basic connection
    await prisma.$queryRaw`SELECT 1`
    console.log('🔍 DB TEST: Basic connection successful')

    // Test user table
    const userCount = await prisma.user.count()
    console.log('🔍 DB TEST: User count:', userCount)

    // Test admin table
    const adminCount = await prisma.admin.count()
    console.log('🔍 DB TEST: Admin count:', adminCount)

    // Test channel table
    const channelCount = await prisma.channel.count()
    console.log('🔍 DB TEST: Channel count:', channelCount)

    // Test product table
    const productCount = await prisma.product.count()
    console.log('🔍 DB TEST: Product count:', productCount)

    // Test subscription table
    const subscriptionCount = await prisma.subscription.count()
    console.log('🔍 DB TEST: Subscription count:', subscriptionCount)

    return NextResponse.json({
      success: true,
      database: 'connected',
      tables: {
        users: userCount,
        admins: adminCount,
        channels: channelCount,
        products: productCount,
        subscriptions: subscriptionCount
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('🔍 DB TEST: Database error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}