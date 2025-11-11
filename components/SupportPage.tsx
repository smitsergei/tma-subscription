'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftIcon, MessageCircleIcon } from 'lucide-react';
import { useTelegram } from '@/hooks/useTelegram';

interface SupportPageProps {
  onBack: () => void;
  isFirstVisit?: boolean;
}

export default function SupportPage({ onBack, isFirstVisit = false }: SupportPageProps) {
  const { tg } = useTelegram();
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  useEffect(() => {
    // Устанавливаем заголовок страницы
    if (tg) {
      tg.setHeaderColor('#1f2937');
      tg.setBackgroundColor('#1f2937');
    }
  }, [tg]);

  const handleOpenTelegramChat = () => {
    setIsOpeningChat(true);

    try {
      // Открываем Telegram чат с ботом
      const botUsername = 'smitcont_bot';
      const telegramUrl = `https://t.me/${botUsername}`;

      // В Telegram Mini App используем tg.openTelegramLink
      if (tg && tg.openTelegramLink) {
        tg.openTelegramLink(telegramUrl);
      } else {
        // Fallback для обычного браузера
        window.open(telegramUrl, '_blank');
      }
    } catch (error) {
      console.error('Ошибка при открытии Telegram чата:', error);
      // Запасной вариант
      window.open('https://t.me/smitcont_bot', '_blank');
    } finally {
      setIsOpeningChat(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      {/* Заголовок страницы */}
      <div className="flex items-center mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ArrowLeftIcon size={24} />
          <span>Назад</span>
        </button>
      </div>

      {/* Основной контент */}
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-4">
            {isFirstVisit ? 'Добро пожаловать! 🎉' : 'Поддержка'}
          </h1>
          <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircleIcon size={32} className="text-white" />
          </div>
          {isFirstVisit && (
            <p className="text-blue-300 text-sm mb-4">
              Рады приветствовать вас в нашем приложении!
            </p>
          )}
        </div>

        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {isFirstVisit ? 'Как начать работу?' : 'Нужна помощь?'}
          </h2>
          <p className="text-gray-300 mb-6 leading-relaxed">
            {isFirstVisit
              ? 'Добро пожаловать в наше приложение! Здесь вы можете оформить подписку на эксклюзивный контент. Если у вас есть вопросы или нужна помощь с регистрацией и оплатой, наша поддержка всегда готова помочь.'
              : 'По всем вопросам, связанным с подписками, платежами или работой приложения, пожалуйста, обращайтесь в нашу службу поддержки. Мы постараемся ответить вам в кратчайшие сроки и помочь решить любые возникшие проблемы.'
            }
          </p>

          <div className="space-y-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Часы работы поддержки:</h3>
              <p className="text-gray-300">Ежедневно с 9:00 до 21:00 (МСК)</p>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Среднее время ответа:</h3>
              <p className="text-gray-300">Обычно 5-15 минут</p>
            </div>
          </div>
        </div>

        {/* Кнопка связи с поддержкой */}
        <button
          onClick={handleOpenTelegramChat}
          disabled={isOpeningChat}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 disabled:opacity-50
                     text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200
                     transform active:scale-95 flex items-center justify-center gap-3"
        >
          {isOpeningChat ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Открытие чата...</span>
            </>
          ) : (
            <>
              <MessageCircleIcon size={20} />
              <span>Написать в поддержку</span>
            </>
          )}
        </button>

        {/* Дополнительная информация */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Нажмите на кнопку выше, чтобы перейти в чат с нашим ботом поддержки
          </p>
          <p className="text-gray-400 text-sm mt-1">
            @smitcont_bot
          </p>
        </div>
      </div>
    </div>
  );
}