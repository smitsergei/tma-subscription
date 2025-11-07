'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function HomePage() {
  const [isTelegram, setIsTelegram] = useState(false)
  const searchParams = useSearchParams()
  const tgWebAppStartParam = searchParams.get('tgWebAppStartParam')

  useEffect(() => {
    // Проверяем, открыто ли приложение в Telegram
    const isInTelegram = window.Telegram?.WebApp?.initData
    setIsTelegram(!!isInTelegram)

    if (isInTelegram) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
    }
  }, [])

  if (isTelegram) {
    // Показываем загрузку, затем перенаправляем в TMA
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="loading-spinner w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка приложения...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center fade-in">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.56l-1.68 7.92c-.12.57-.5.71-.97.44l-2.68-1.98-1.29 1.25c-.14.14-.26.26-.53.26l.19-2.66 4.96-4.48c.21-.19-.05-.29-.33-.11l-6.14 3.86-2.65-.83c-.57-.18-.52-.57.12-.84l10.33-3.98c.47-.17.89.11.74.84z"/>
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">TMA-Подписка</h1>
        <p className="text-gray-600 mb-8">
          Платформа для продажи подписок на закрытые Telegram-каналы
        </p>

        <div className="space-y-4">
          <Link
            href="/app"
            className="block w-full bg-blue-600 text-white py-3 px-6 rounded-xl hover:bg-blue-700 transition-colors duration-200 font-medium"
          >
            🚀 Открыть Mini App
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Как начать работу:</p>
          <div className="text-left space-y-2 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <span className="text-blue-600">1.</span>
              <span>Откройте Telegram и запустите нашего бота командой /start</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-600">2.</span>
              <span>Нажмите кнопку "🚀 Открыть Mini App" в сообщении бота</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-600">3.</span>
              <span>Выберите подходящую подписку и оформите доступ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}