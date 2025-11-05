import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('🔧 Создание канала...')

    // Создаем канал
    const channel = await prisma.channel.create({
      data: {
        channelId: BigInt(-1002413806638),
        name: 'VIP Контент',
        username: null, // Можно добавить позже если будет @username
        description: 'Эксклюзивный контент для подписчиков'
      }
    })

    console.log('✅ Канал создан:', channel)

    console.log('🔧 Создание продукта...')

    // Создаем продукт
    const product = await prisma.product.create({
      data: {
        channelId: channel.channelId,
        name: 'VIP подписка на 30 дней',
        description: 'Полный доступ к эксклюзивному контенту на 30 дней',
        price: 10.00, // $10 в USDT
        periodDays: 30,
        discountPrice: 8.00, // Скидка до $8
        isTrial: false,
        isActive: true
      }
    })

    console.log('✅ Продукт создан:', product)
    console.log('')
    console.log('🎉 Готово! Первый продукт для продажи настроен!')
    console.log('')
    console.log('📋 Детали продукта:')
    console.log(`- Название: ${product.name}`)
    console.log(`- Цена: $${product.price} USDT (скидка $${product.discountPrice} USDT)`)
    console.log(`- Период: ${product.periodDays} дней`)
    console.log(`- Канал: ${channel.name}`)
    console.log('')
    console.log('🚀 Теперь можно тестировать покупку через Telegram Mini App!')

  } catch (error) {
    console.error('❌ Ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()