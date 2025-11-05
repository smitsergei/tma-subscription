import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // Сначала создаем пользователя (если его нет)
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(257394938) },
      update: {},
      create: {
        telegramId: BigInt(257394938),
        firstName: 'Admin',
        username: 'admin'
      }
    })

    // Затем добавляем администратора
    const admin = await prisma.admin.create({
      data: {
        telegramId: BigInt(257394938)
      }
    })

    console.log('✅ Администратор успешно добавлен!')
    console.log('User ID:', user.telegramId.toString())
    console.log('Admin ID:', admin.telegramId.toString())

  } catch (error) {
    console.error('❌ Ошибка при добавлении администратора:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()