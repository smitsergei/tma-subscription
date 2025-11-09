import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 PRODUCTS: Starting products fetch')

    // Получаем только активные продукты с информацией о каналах
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`🔍 PRODUCTS: Found ${products.length} products`)

    return NextResponse.json({
      success: true,
      data: products.map(product => ({
        productId: product.productId.toString(),
        name: product.name,
        description: product.description,
        price: parseFloat(product.price.toString()),
        discountPrice: product.discountPrice ? parseFloat(product.discountPrice.toString()) : null,
        periodDays: product.periodDays,
        isTrial: product.isTrial,
        isActive: product.isActive,
        allowDemo: product.allowDemo,
        demoDays: product.demoDays,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        channel: product.channel ? {
          channelId: product.channel.channelId.toString(),
          name: product.channel.name,
          username: product.channel.username
        } : null
      }))
    })
  } catch (error) {
    console.error('🔍 PRODUCTS: Error fetching products:', error)
    console.error('🔍 PRODUCTS: Error details:', {
      message: (error as Error).message,
      stack: (error as Error).stack
    })

    // Проверяем, что ошибка связана с BigInt
    if ((error as Error).message.includes('BigInt')) {
      console.error('🔍 PRODUCTS: BigInt serialization error detected')
    }

    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки продуктов', details: (error as Error).message },
      { status: 500 }
    )
  }
}