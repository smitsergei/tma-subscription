'use client'

import { useState } from 'react'
import Script from 'next/script'

interface AdminAuthProps {
  onAuthSuccess: () => void
}

export function AdminAuth({ onAuthSuccess }: AdminAuthProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTelegramAuth = async () => {
    if (!window.Telegram?.WebApp) {
      setError('Авторизация доступна только через Telegram')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const tg = window.Telegram.WebApp
      const initData = tg.initData

      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initData }),
      })

      const result = await response.json()

      if (result.success) {
        onAuthSuccess()
      } else {
        setError(result.error || 'Ошибка авторизации')
      }
    } catch (err) {
      setError('Ошибка подключения к серверу')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Вход в админ-панель
          </h2>
          <p className="text-gray-600 text-sm">
            Войдите через Telegram для доступа к управлению
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleTelegramAuth}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Авторизация...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.56l-1.68 7.92c-.12.57-.5.71-.97.44l-2.68-1.98-1.29 1.25c-.14.14-.26.26-.53.26l.19-2.66 4.96-4.48c.21-.19-.05-.29-.33-.11l-6.14 3.86-2.65-.83c-.57-.18-.52-.57.12-.84l10.33-3.98c.47-.17.89.11.74.84z"/>
              </svg>
              <span>Войти через Telegram</span>
            </>
          )}
        </button>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 text-center">
            Ваш Telegram ID должен быть добавлен в список администраторов
          </p>
        </div>
      </div>
    </>
  )
}