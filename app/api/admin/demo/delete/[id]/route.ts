import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Утилита для безопасной сериализации BigInt
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}

// Функция для создания аутентифицированного ответа
function createJsonResponse(data: any, status: number = 200): NextResponse {
  return new NextResponse(safeStringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const demoId = params.id

    console.log('🗑️ Deleting demo access:', demoId)

    // Проверяем существование демо-доступа
    const existingDemo = await prisma.demoAccess.findUnique({
      where: { id: demoId },
      include: {
        user: {
          select: {
            telegramId: true,
            firstName: true,
            username: true
          }
        },
        product: {
          select: {
            productId: true,
            name: true,
            channel: {
              select: {
                channelId: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!existingDemo) {
      return createJsonResponse(
        { error: 'Демо-доступ не найден' },
        404
      )
    }

    console.log('🔍 Found demo access to delete:', {
      id: existingDemo.id,
      user: existingDemo.user.firstName,
      product: existingDemo.product.name,
      isActive: existingDemo.isActive
    })

    // Если демо-доступ был активен, удаляем пользователя из канала
    if (existingDemo.isActive) {
      try {
        const botToken = process.env.BOT_TOKEN
        if (botToken && existingDemo.product?.channel) {
          await removeUserFromChannel(
            existingDemo.user.telegramId.toString(),
            existingDemo.product.channel.channelId.toString(),
            botToken
          )
          console.log('✅ User removed from channel during demo deletion')
        }
      } catch (error) {
        console.error('⚠️ Error removing user from channel:', error)
        // Продолжаем удаление даже если не удалось удалить из канала
      }
    }

    // Полностью удаляем запись о демо-доступе из базы данных
    await prisma.demoAccess.delete({
      where: { id: demoId }
    })

    console.log('✅ Demo access deleted successfully:', demoId)

    return createJsonResponse({
      success: true,
      message: 'Демо-доступ успешно удален',
      deletedDemo: {
        id: existingDemo.id,
        user: existingDemo.user.firstName,
        product: existingDemo.product.name
      }
    })

  } catch (error) {
    console.error('❌ Error deleting demo access:', error)
    return createJsonResponse(
      {
        error: 'Внутренняя ошибка сервера',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

// Вспомогательная функция для удаления пользователя из канала
async function removeUserFromChannel(userId: string, channelId: string, botToken: string): Promise<void> {
  try {
    // Проверяем, состоит ли пользователь в канале
    const chatMemberResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: channelId,
          user_id: userId
        })
      }
    )

    const chatMemberData = await chatMemberResponse.json()

    if (chatMemberData.ok) {
      const status = chatMemberData.result.status

      // Если пользователь состоит в канале (не left/kicked), пытаемся его удалить
      if (status !== 'left' && status !== 'kicked') {
        // Для каналов нужно использовать ban/unban, так как прямого удаления нет
        // Сначала баним, потом разбаним (это удалит пользователя из канала)
        await fetch(
          `https://api.telegram.org/bot${botToken}/banChatMember`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channelId,
              user_id: userId,
              revoke_messages: false
            })
          }
        )

        // Сразу разбаниваем (чтобы пользователь мог снова войти при покупке подписки)
        await fetch(
          `https://api.telegram.org/bot${botToken}/unbanChatMember`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: channelId,
              user_id: userId,
              only_if_banned: true
            })
          }
        )
      }
    }
  } catch (error) {
    console.error(`Error removing user ${userId} from channel ${channelId}:`, error)
    throw error
  }
}