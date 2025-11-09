import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 PRODUCTS: Starting products fetch')

    // Получаем только активные продукты с информацией о каналах и активными скидками
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
    })

    console.log(`🔍 PRODUCTS: Found ${products.length} products`)

    // Применяем логику скидок к каждому продукту
    const productsWithDiscounts = products.map(product => {
      let finalPrice = parseFloat(product.price.toString())
      let discountPrice = product.discountPrice ? parseFloat(product.discountPrice.toString()) : null
      let activeDiscount = null

      // Если у продукта есть постоянная скидка (discountPrice), используем её
      if (discountPrice && discountPrice < finalPrice) {
        finalPrice = discountPrice
      }

      // Проверяем временные скидки
      if (product.discounts && product.discounts.length > 0) {
        const tempDiscount = product.discounts[0] // Берем последнюю активную скидку
        const calculatedDiscountPrice = calculateDiscountPrice(
          parseFloat(product.price.toString()),
          tempDiscount.type,
          parseFloat(tempDiscount.value.toString())
        )

        // Если временная скидка лучше, чем текущая цена, применяем её
        if (calculatedDiscountPrice < finalPrice) {
          finalPrice = calculatedDiscountPrice
          activeDiscount = {
            type: tempDiscount.type,
            value: parseFloat(tempDiscount.value.toString()),
            endDate: tempDiscount.endDate
          }
        }
      }

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
        allowDemo: product.allowDemo,
        demoDays: product.demoDays,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        activeDiscount, // Информация о временной скидке
        channel: product.channel ? {
          channelId: product.channel.channelId.toString(),
          name: product.channel.name,
          username: product.channel.username
        } : null
      }
    })

    return NextResponse.json({
      success: true,
      data: productsWithDiscounts
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

// Функция для расчета цены со скидкой
function calculateDiscountPrice(originalPrice: number, discountType: 'PERCENTAGE' | 'FIXED_AMOUNT', discountValue: number): number {
  if (discountType === 'PERCENTAGE') {
    return Math.max(0, originalPrice * (1 - discountValue / 100))
  } else {
    return Math.max(0, originalPrice - discountValue)
  }
}