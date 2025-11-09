'use client'

import { useState, useEffect } from 'react'
import { formatPrice, formatDate } from '@/lib/utils'

interface Payment {
  paymentId: string
  userId: string
  amount: number
  currency: string
  status: 'pending' | 'success' | 'failed'
  txHash?: string
  memo: string
  createdAt: string
  user?: {
    telegramId: string
    username?: string
    firstName: string
  }
  product?: {
    productId: string
    name: string
    price: number
    periodDays: number
    channel?: {
      channelId: string
      name: string
    }
  }
}

export default function PaymentsTestPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)

  // Загрузка платежей с использованием заглушки для аутентификации
  const loadPayments = async () => {
    try {
      setLoading(true)
      setError(null)

      // Создаем заглушку для тестирования без Telegram WebApp
      const mockInitData = 'query_id=test&user=%7B%22id%22%3A123456%2C%22first_name%22%3A%22Test%20Admin%22%7D&auth_date=1234567890&hash=test_hash'

      const response = await fetch('/admin/payments', {
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': mockInitData
        }
      })

      const data = await response.json()

      if (data.success) {
        setPayments(data.data.payments)
        setStats(data.data.stats)
      } else {
        setError(data.error || 'Ошибка загрузки платежей')
      }
    } catch (err) {
      setError('Ошибка загрузки платежей')
    } finally {
      setLoading(false)
    }
  }

  // Действие с платежом
  const handlePaymentAction = async (paymentId: string, action: 'confirm' | 'reject' | 'reset') => {
    try {
      const mockInitData = 'query_id=test&user=%7B%22id%22%3A123456%2C%22first_name%22%3A%22Test%20Admin%22%7D&auth_date=1234567890&hash=test_hash'

      const response = await fetch('/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': mockInitData
        },
        body: JSON.stringify({
          paymentId,
          action
        })
      })

      const data = await response.json()

      if (data.success) {
        loadPayments() // Перезагрузка списка
      } else {
        setError(data.error || 'Ошибка выполнения действия')
      }
    } catch (err) {
      setError('Ошибка выполнения действия')
    }
  }

  useEffect(() => {
    loadPayments()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'success': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Ожидает'
      case 'success': return 'Подтвержден'
      case 'failed': return 'Отклонен'
      default: return status
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">💳 Управление платежами (Тест)</h1>
          <p className="text-gray-600">Страница для тестирования управления платежами без Telegram WebApp</p>
        </div>

        {/* Навигация */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-wrap gap-4">
            <a href="/admin" className="text-blue-600 hover:text-blue-800 underline">
              🏠 Главная админка
            </a>
            <a href="/admin/payments-client" className="text-blue-600 hover:text-blue-800 underline">
              📱 Платежи (Telegram WebApp)
            </a>
            <a href="/test-payment" className="text-blue-600 hover:text-blue-800 underline">
              🧪 Тестирование платежей
            </a>
          </div>
        </div>

        {/* Статистика */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Всего платежей</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-800">{stats.pending}</div>
              <div className="text-sm text-yellow-600">Ожидают</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-800">{stats.success}</div>
              <div className="text-sm text-green-600">Подтверждены</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="text-2xl font-bold text-red-800">{stats.failed}</div>
              <div className="text-sm text-red-600">Отклонены</div>
            </div>
          </div>
        )}

        {/* Уведомления */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800">{error}</div>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-red-600 underline text-sm"
            >
              Скрыть
            </button>
          </div>
        )}

        {/* Таблица платежей */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={loadPayments}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Загрузка...' : '🔄 Обновить'}
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Загрузка платежей...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-500 mb-2">📭</div>
              <p className="text-gray-600">Платежи не найдены</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID Платежа
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Пользователь
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Продукт
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Сумма
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Создан
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.paymentId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-900">
                          {payment.paymentId.slice(0, 12)}...
                        </div>
                        {payment.memo && (
                          <div className="text-xs text-gray-500 mt-1">
                            Memo: {payment.memo.slice(0, 16)}...
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {payment.user?.firstName || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {payment.userId}
                          {payment.user?.username && ` (@${payment.user.username})`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {payment.product?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {payment.product?.periodDays} дней
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatPrice(payment.amount, payment.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                          {getStatusText(payment.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {payment.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handlePaymentAction(payment.paymentId, 'confirm')}
                                className="text-green-600 hover:text-green-900"
                              >
                                ✅
                              </button>
                              <button
                                onClick={() => handlePaymentAction(payment.paymentId, 'reject')}
                                className="text-red-600 hover:text-red-900"
                              >
                                ❌
                              </button>
                            </>
                          )}
                          {payment.status !== 'pending' && (
                            <button
                              onClick={() => handlePaymentAction(payment.paymentId, 'reset')}
                              className="text-yellow-600 hover:text-yellow-900"
                            >
                              🔄
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Информация */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">ℹ️ Информация:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>✅ - Подтвердить платеж (создает подписку и добавляет в канал)</li>
            <li>❌ - Отклонить платеж</li>
            <li>🔄 - Сбросить в статус ожидания</li>
            <li>Эта страница использует заглушку для аутентификации</li>
            <li>Для продакшена используйте страницу с Telegram WebApp</li>
          </ul>
        </div>
      </div>
    </div>
  )
}