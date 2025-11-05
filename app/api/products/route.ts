import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json({
      success: true,
      data: products.map(product => ({
        ...product,
        channelId: product.channelId.toString(),
        price: parseFloat(product.price.toString()),
        discountPrice: product.discountPrice ? parseFloat(product.discountPrice.toString()) : null,
        channel: product.channel ? {
          ...product.channel,
          channelId: product.channel.channelId.toString()
        } : null
      }))
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { success: false, error: 'Ошибка загрузки продуктов' },
      { status: 500 }
    )
  }
}