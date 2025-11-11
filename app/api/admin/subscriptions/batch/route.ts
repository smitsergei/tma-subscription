import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateTelegramInitData } from '@/lib/utils'
import { syncChannelAccess } from '@/lib/botSync'

export const dynamic = 'force-dynamic'

async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const initData = request.headers.get('x-telegram-init-data')
  if (!initData) return false

  const urlParams = new URLSearchParams(initData)
  const userStr = urlParams.get('user')
  if (!userStr) return false

  const user = JSON.parse(decodeURIComponent(userStr))
  const telegramId = BigInt(user.id)

  // Для тестовых данных пропускаем валидацию хеша
  const isTestData = initData.includes('test_hash_for_development')
  if (!isTestData) {
    if (!validateTelegramInitData(initData, process.env.BOT_TOKEN!)) return false
  }

  const admin = await prisma.admin.findUnique({
    where: { telegramId }
  })

  if (!admin) {
    // Создаем админа если его нет (для тестовых данных)
    try {
      await prisma.user.upsert({
        where: { telegramId },
        update: {},
        create: {
          telegramId,
          firstName: user.first_name || 'Admin',
          username: user.username || 'admin',
        }
      })

      await prisma.admin.create({
        data: { telegramId }
      })

      return true
    } catch (createError) {
      console.error('🔍 BATCH AUTH: Failed to create admin record:', createError)
      return false
    }
  }

  return true
}

/**
 * Массовое создание подписок
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 BATCH API: Starting bulk subscription creation...')

    if (!(await checkAdminAuth(request))) {
      console.log('🔍 BATCH API: Authentication failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 BATCH API: Authentication successful')

    const { subscriptions } = await request.json()

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return NextResponse.json(
        { error: 'Subscriptions array is required' },
        { status: 400 }
      )
    }

    console.log('🔍 BATCH API: Processing', subscriptions.length, 'subscriptions')

    const results = []
    let successCount = 0
    let errorCount = 0

    for (const subData of subscriptions) {
      try {
        const { userId, productId, status = 'active', expiresAt } = subData

        if (!userId || !productId) {
          results.push({
            success: false,
            error: 'userId and productId are required',
            data: subData
          })
          errorCount++
          continue
        }

        // Проверяем, существует ли пользователь
        const user = await prisma.user.findUnique({
          where: { telegramId: BigInt(userId) }
        })

        if (!user) {
          results.push({
            success: false,
            error: 'User not found',
            data: subData
          })
          errorCount++
          continue
        }

        // Проверяем, существует ли продукт
        const product = await prisma.product.findUnique({
          where: { productId }
        })

        if (!product) {
          results.push({
            success: false,
            error: 'Product not found',
            data: subData
          })
          errorCount++
          continue
        }

        // Проверяем, нет ли уже такой подписки
        const existingSubscription = await prisma.subscription.findFirst({
          where: {
            userId: user.telegramId,
            productId,
            status: 'active'
          }
        })

        if (existingSubscription) {
          results.push({
            success: false,
            error: 'Active subscription already exists',
            data: subData
          })
          errorCount++
          continue
        }

        // Создаем подписку
        const subscriptionData = await prisma.subscription.create({
          data: {
            userId: user.telegramId,
            productId,
            channelId: product.channelId,
            status,
            expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          },
          include: {
            user: true,
            product: {
              include: {
                channel: true
              }
            }
          }
        })

        // Синхронизация доступа к каналу
        let syncSuccess = true
        let syncError = null

        if (subscriptionData.product?.channel && subscriptionData.status === 'active') {
          try {
            console.log('🤖 BATCH API: Syncing channel access for subscription:', subscriptionData.subscriptionId)
            const syncResult = await syncChannelAccess(
              subscriptionData.userId.toString(),
              subscriptionData.product.channel.channelId.toString(),
              subscriptionData.status,
              subscriptionData.product.name,
              subscriptionData.product.channel.name,
              subscriptionData.expiresAt
            )

            if (!syncResult.success) {
              syncSuccess = false
              syncError = syncResult.error
              console.error('🤖 BATCH API: Failed to sync channel access:', syncResult.error)
            } else {
              console.log('🤖 BATCH API: Channel access synced successfully')
            }
          } catch (error) {
            syncSuccess = false
            syncError = error instanceof Error ? error.message : 'Unknown sync error'
            console.error('🤖 BATCH API: Error syncing channel access:', error)
          }
        }

        results.push({
          success: true,
          subscription: {
            subscriptionId: subscriptionData.subscriptionId,
            userId: subscriptionData.userId.toString(),
            productId: subscriptionData.productId,
            status: subscriptionData.status,
            expiresAt: subscriptionData.expiresAt
          },
          syncSuccess,
          syncError,
          data: subData
        })

        successCount++

      } catch (error) {
        console.error('🔍 BATCH API: Error processing subscription:', subData, error)
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          data: subData
        })
        errorCount++
      }
    }

    console.log('🔍 BATCH API: Batch operation completed:', { successCount, errorCount })

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: subscriptions.length,
        successful: successCount,
        failed: errorCount
      }
    })

  } catch (error) {
    console.error('🔍 BATCH API: Error in bulk subscription creation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Массовое обновление статусов подписок
 */
export async function PUT(request: NextRequest) {
  try {
    console.log('🔍 BATCH API: Starting bulk subscription update...')

    if (!(await checkAdminAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subscriptionIds, status, expiresAt } = await request.json()

    if (!Array.isArray(subscriptionIds) || subscriptionIds.length === 0) {
      return NextResponse.json(
        { error: 'Subscription IDs array is required' },
        { status: 400 }
      )
    }

    if (!status && !expiresAt) {
      return NextResponse.json(
        { error: 'Status or expiresAt is required' },
        { status: 400 }
      )
    }

    console.log('🔍 BATCH API: Updating', subscriptionIds.length, 'subscriptions')

    const results = []
    let successCount = 0
    let errorCount = 0

    for (const subscriptionId of subscriptionIds) {
      try {
        // Получаем текущие данные подписки
        const currentSubscription = await prisma.subscription.findUnique({
          where: { subscriptionId },
          include: {
            user: true,
            product: {
              include: {
                channel: true
              }
            }
          }
        })

        if (!currentSubscription) {
          results.push({
            subscriptionId,
            success: false,
            error: 'Subscription not found'
          })
          errorCount++
          continue
        }

        // Обновляем подписку
        const updatedSubscription = await prisma.subscription.update({
          where: { subscriptionId },
          data: {
            ...(status && { status }),
            ...(expiresAt && { expiresAt: new Date(expiresAt) })
          },
          include: {
            user: true,
            product: {
              include: {
                channel: true
              }
            }
          }
        })

        // Синхронизация доступа к каналу при изменении статуса
        let syncSuccess = true
        let syncError = null

        if (status && updatedSubscription.product?.channel) {
          try {
            console.log('🤖 BATCH API: Syncing channel access for updated subscription:', subscriptionId)
            const syncResult = await syncChannelAccess(
              updatedSubscription.userId.toString(),
              updatedSubscription.product.channel.channelId.toString(),
              status,
              updatedSubscription.product.name,
              updatedSubscription.product.channel.name,
              updatedSubscription.expiresAt
            )

            if (!syncResult.success) {
              syncSuccess = false
              syncError = syncResult.error
              console.error('🤖 BATCH API: Failed to sync channel access:', syncResult.error)
            } else {
              console.log('🤖 BATCH API: Channel access synced successfully')
            }
          } catch (error) {
            syncSuccess = false
            syncError = error instanceof Error ? error.message : 'Unknown sync error'
            console.error('🤖 BATCH API: Error syncing channel access:', error)
          }
        }

        results.push({
          subscriptionId,
          success: true,
          updatedSubscription: {
            subscriptionId: updatedSubscription.subscriptionId,
            status: updatedSubscription.status,
            expiresAt: updatedSubscription.expiresAt
          },
          syncSuccess,
          syncError
        })

        successCount++

      } catch (error) {
        console.error('🔍 BATCH API: Error updating subscription:', subscriptionId, error)
        results.push({
          subscriptionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        errorCount++
      }
    }

    console.log('🔍 BATCH API: Bulk update completed:', { successCount, errorCount })

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: subscriptionIds.length,
        successful: successCount,
        failed: errorCount
      }
    })

  } catch (error) {
    console.error('🔍 BATCH API: Error in bulk subscription update:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}