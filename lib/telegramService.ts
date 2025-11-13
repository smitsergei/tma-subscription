import { prisma } from '@/lib/db';
import { MessageStatus } from '@prisma/client';

interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  disable_web_page_preview?: boolean;
  reply_markup?: any;
}

interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
  error_code?: number;
}

class TelegramService {
  private botToken: string;
  private baseUrl: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '';
    if (!this.botToken) {
      console.warn('TELEGRAM_BOT_TOKEN не найден в переменных окружения, используйте тестовый режим');
      // Не бросаем ошибку, а логируем предупреждение
    }
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  /**
   * Отправка сообщения пользователю
   */
  async sendMessage(message: TelegramMessage): Promise<TelegramResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const data = await response.json() as TelegramResponse;
      return data;
    } catch (error) {
      console.error('[TELEGRAM_SEND_ERROR]', error);
      return {
        ok: false,
        description: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Отправка сообщения с обработкой ошибок и повторными попытками
   */
  async sendMessageWithRetry(
    message: TelegramMessage,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<TelegramResponse> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.sendMessage(message);

        if (response.ok) {
          return response;
        }

        // Если пользователь заблокировал бота, не повторяем попытки
        if (response.error_code === 403) {
          return response;
        }

        // Если превышен лимит частоты, ждем и повторяем
        if (response.error_code === 429) {
          const retryAfter = response.description?.match(/retry after (\d+)/)?.[1];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : retryDelay;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        lastError = response;

        // Ждем перед следующей попыткой
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }

    return lastError || {
      ok: false,
      description: `Failed after ${maxRetries} attempts`,
    };
  }

  /**
   * Проверка, является ли ошибка блокировкой бота
   */
  isBotBlocked(errorDescription?: string): boolean {
    if (!errorDescription) return false;

    const blockedPhrases = [
      'bot was blocked by the user',
      'user is deactivated',
      'chat not found',
      'Forbidden: bot was blocked by the user'
    ];

    return blockedPhrases.some(phrase =>
      errorDescription.toLowerCase().includes(phrase.toLowerCase())
    );
  }

  /**
   * Получение информации о чате
   */
  async getChat(chatId: string | number): Promise<TelegramResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/getChat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chat_id: chatId }),
      });

      return await response.json() as TelegramResponse;
    } catch (error) {
      console.error('[TELEGRAM_GET_CHAT_ERROR]', error);
      return {
        ok: false,
        description: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Отправка рассылки (массовая отправка)
   */
  async sendBroadcast(
    broadcastId: string,
    messageText: string,
    recipients: bigint[],
    parseMode: 'HTML' | 'Markdown' = 'HTML'
  ): Promise<void> {
    const batchSize = 10; // Размер батча для одновременной отправки
    const delayBetweenBatches = 1000; // Задержка между батчами в мс

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      // Отправляем сообщения в батче параллельно
      const promises = batch.map(async (userId) => {
        const messageRecord = await prisma.broadcastMessage.findFirst({
          where: {
            broadcastId,
            userId
          }
        });

        if (!messageRecord || messageRecord.status !== MessageStatus.PENDING) {
          return;
        }

        try {
          const response = await this.sendMessageWithRetry({
            chat_id: userId.toString(),
            text: messageText,
            parse_mode: parseMode,
          });

          if (response.ok && response.result) {
            // Успешная отправка
            await prisma.broadcastMessage.update({
              where: { messageId: messageRecord.messageId },
              data: {
                status: MessageStatus.SENT,
                sentAt: new Date(),
                telegramMessageId: response.result.message_id,
              },
            });

            // Обновляем счетчики в рассылке
            await prisma.broadcast.update({
              where: { broadcastId },
              data: {
                sentCount: { increment: 1 },
              },
            });
          } else {
            // Ошибка отправки
            const isBlocked = this.isBotBlocked(response.description);

            await prisma.broadcastMessage.update({
              where: { messageId: messageRecord.messageId },
              data: {
                status: MessageStatus.FAILED,
                error: response.description || 'Unknown error',
              },
            });

            // Обновляем счетчики в рассылке
            await prisma.broadcast.update({
              where: { broadcastId },
              data: {
                failedCount: { increment: 1 },
              },
            });

            // Если пользователь заблокировал бота, можно добавить его в черный список
            if (isBlocked) {
              console.log(`User ${userId} blocked the bot`);
              // Здесь можно добавить логику для обновления статуса пользователя
            }
          }
        } catch (error) {
          console.error(`[BROADCAST_SEND_ERROR] User: ${userId}`, error);

          await prisma.broadcastMessage.update({
            where: { messageId: messageRecord.messageId },
            data: {
              status: MessageStatus.FAILED,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          });

          await prisma.broadcast.update({
            where: { broadcastId },
            data: {
              failedCount: { increment: 1 },
            },
          });
        }
      });

      // Ждем завершения всех отправок в батче
      await Promise.all(promises);

      // Добавляем задержку между батчами для избежания лимитов
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }
  }

  /**
   * Форматирование текста с поддержкой HTML
   */
  formatText(text: string, variables?: Record<string, string>): string {
    let formattedText = text;

    // Замена переменных
    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        formattedText = formattedText.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
    }

    return formattedText;
  }

  /**
   * Создание кнопок для сообщения
   */
  createInlineKeyboard(buttons: Array<{ text: string; url?: string; callback_data?: string }[]>): any {
    return {
      inline_keyboard: buttons,
    };
  }

  /**
   * Отправка сообщения с кнопками
   */
  async sendMessageWithButtons(
    chatId: string | number,
    text: string,
    buttons: Array<{ text: string; url?: string; callback_data?: string }[]>,
    parseMode: 'HTML' | 'Markdown' = 'HTML'
  ): Promise<TelegramResponse> {
    return this.sendMessage({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      reply_markup: this.createInlineKeyboard(buttons),
    });
  }
}

// Экспорт экземпляра сервиса
export const telegramService = new TelegramService();

// Экспорт класса для возможного создания других экземпляров
export { TelegramService };