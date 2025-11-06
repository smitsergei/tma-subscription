'use client'

import { useState, useEffect } from 'react'

export default function AdminTest() {
  const [authStatus, setAuthStatus] = useState<string>('Проверка...')
  const [telegramData, setTelegramData] = useState<any>(null)

  useEffect(() => {
    // Проверяем, находимся ли мы в Telegram WebApp
    const isInTelegram = window.Telegram?.WebApp?.initData

    if (isInTelegram) {
      setAuthStatus('✅ В Telegram WebApp')
      setTelegramData({
        initData: window.Telegram.WebApp.initData,
        user: window.Telegram.WebApp.initDataUnsafe?.user
      })
    } else {
      setAuthStatus('❌ Не в Telegram WebApp')
      setTelegramData(null)
    }
  }, [])

  const testApi = async () => {
    try {
      const response = await fetch('/api/admin/products', {
        headers: {
          'Content-Type': 'application/json',
          ...(telegramData?.initData && {
            'x-telegram-init-data': telegramData.initData
          })
        }
      })

      if (response.ok) {
        const data = await response.json()
        alert(`✅ API работает! Найдено продуктов: ${data.products?.length || 0}`)
      } else {
        const error = await response.json()
        alert(`❌ Ошибка API: ${error.error}`)
      }
    } catch (error) {
      alert(`❌ Ошибка запроса: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold mb-6">🔧 Тестирование админ-панели</h1>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h2 className="font-semibold text-lg mb-2">Статус аутентификации</h2>
              <p className="text-lg">{authStatus}</p>
            </div>

            {telegramData && (
              <div className="p-4 bg-green-50 rounded-lg">
                <h2 className="font-semibold text-lg mb-2">Данные Telegram</h2>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(telegramData.user, null, 2)}
                </pre>
              </div>
            )}

            <div className="p-4 bg-yellow-50 rounded-lg">
              <h2 className="font-semibold text-lg mb-2">Инструкция по использованию</h2>
              <ol className="list-decimal list-inside space-y-2">
                <li>Откройте Telegram</li>
                <li>Найдите бота: <strong>@tma_subscription_bot</strong></li>
                <li>Отправьте команду: <code>/admin</code></li>
                <li>Нажмите на кнопку: "Админ-панель"</li>
                <li>В открывшемся Mini App управляйте продуктами</li>
              </ol>
            </div>

            <div className="p-4 bg-red-50 rounded-lg">
              <h2 className="font-semibold text-lg mb-2">⚠️ Важно!</h2>
              <p>Админ-панель работает <strong>ТОЛЬКО</strong> через Telegram WebApp.</p>
              <p>Прямой доступ через браузер не поддерживается из-за требований безопасности.</p>
            </div>

            <button
              onClick={testApi}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition"
            >
              🧪 Тестировать API
            </button>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h2 className="font-semibold text-lg mb-2">Быстрые ссылки</h2>
              <div className="space-y-2">
                <a href="https://t.me/tma_subscription_bot" target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">
                  🔗 Открыть бота @tma_subscription_bot
                </a>
                <a href="/admin" className="block text-blue-600 hover:underline">
                  🔗 Админ-панель (только через Telegram)
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}