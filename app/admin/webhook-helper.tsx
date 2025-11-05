'use client'

import { useState } from 'react'

export default function WebhookHelper() {
  const [botToken, setBotToken] = useState('')
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const updateWebhook = async () => {
    if (!botToken) {
      setStatus('❌ Введите токен бота')
      return
    }

    setIsLoading(true)
    setStatus('🔄 Обновление webhook...')

    try {
      const response = await fetch('/api/admin/update-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ botToken }),
      })

      const result = await response.json()

      if (response.ok) {
        setStatus(`✅ Webhook успешно обновлен!\n\n${JSON.stringify(result, null, 2)}`)
      } else {
        setStatus(`❌ Ошибка: ${result.error}`)
      }
    } catch (error) {
      setStatus(`❌ Ошибка подключения: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">🔧 Обновление Telegram Webhook</h1>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Токен бота (BOT_TOKEN)
            </label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="7507378625:AAHYFqfuONHKFWQJ4ic3LWb1m7zrE5mQ5Ws"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Токен можно получить у @BotFather
            </p>
          </div>

          <button
            onClick={updateWebhook}
            disabled={isLoading || !botToken}
            className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
              isLoading || !botToken
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? '⏳ Обновление...' : '🚀 Обновить Webhook'}
          </button>

          {status && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">{status}</pre>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <h3 className="text-sm font-medium text-blue-900 mb-2">📝 Информация:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Webhook URL: https://tma-subscription.vercel.app/api/webhook</li>
              <li>• После обновления команды /start и /admin будут работать правильно</li>
              <li>• Кнопки будут вести на актуальную версию приложения</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}