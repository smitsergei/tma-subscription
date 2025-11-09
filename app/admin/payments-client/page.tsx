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
  updatedAt: string
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

interface PaymentsResponse {
  payments: Payment[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats: {
    total: number
    pending: number
    success: number
    failed: number
  }
}

export default function PaymentsClientPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<PaymentsResponse['stats'] | null>(null)
  const [isTelegramLoaded, setIsTelegramLoaded] = useState(false)

  // Фильтры
  const [filters, setFilters] = useState({
    status: '',
    userId: '',
    productId: '',
    search: ''
  })

  // Пагинация
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  })

  // Модальное окно для управления платежом
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Инициализация Telegram WebApp
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-web-app.js'
    script.async = true
    script.onload = () => {
      setIsTelegramLoaded(true)
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready()
        window.Telegram.WebApp.expand()
        window.Telegram.WebApp.setHeaderColor('#1f2937')
      }
    }
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  // Загрузка платежей
  const loadPayments = async (page = 1) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.productId && { productId: filters.productId }),
        ...(filters.search && { search: filters.search })
      })

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }

      // Добавляем Telegram WebApp init data
      if (window.Telegram?.WebApp?.initData) {
        headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData
      }

      const response = await fetch(`/admin/payments?${params}`, { headers })
      const data = await response.json()

      if (data.success) {
        setPayments(data.data.payments)
        setStats(data.data.stats)
        setPagination(data.data.pagination)
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
  const handlePaymentAction = async (paymentId: string, action: 'confirm' | 'reject' | 'reset', txHash?: string) => {
    try {
      setActionLoading(true)

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }

      // Добавляем Telegram WebApp init data
      if (window.Telegram?.WebApp?.initData) {
        headers['X-Telegram-Init-Data'] = window.Telegram.WebApp.initData
      }

      const response = await fetch('/admin/payments', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          paymentId,
          action,
          txHash: action === 'confirm' ? txHash : undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        setShowModal(false)
        setSelectedPayment(null)
        loadPayments(pagination.page) // Перезагрузка списка
      } else {
        setError(data.error || 'Ошибка выполнения действия')
      }
    } catch (err) {
      setError('Ошибка выполнения действия')
    } finally {
      setActionLoading(false)
    }
  }

  // Первоначальная загрузка
  useEffect(() => {
    if (isTelegramLoaded) {
      loadPayments()
    }
  }, [isTelegramLoaded])

  // Обработка фильтров
  useEffect(() => {
    if (filters.status || filters.userId || filters.productId || filters.search) {
      const timeoutId = setTimeout(() => {
        if (isTelegramLoaded) {
          loadPayments(1)
        }
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [filters, isTelegramLoaded])

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

  if (!isTelegramLoaded) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">💳 Управление платежами</h1>
        <p className="text-gray-600">Просмотр и управление всеми платежами системы</p>
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

      {/* Фильтры */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">🔍 Фильтры</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Все статусы</option>
              <option value="pending">Ожидает</option>
              <option value="success">Подтвержден</option>
              <option value="failed">Отклонен</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID пользователя</label>
            <input
              type="text"
              value={filters.userId}
              onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              placeholder="Telegram ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID продукта</label>
            <input
              type="text"
              value={filters.productId}
              onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
              placeholder="Product ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Поиск</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Memo, Payment ID или TX Hash"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Таблица платежей */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Загрузка платежей...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-red-600 mb-2">⚠️ {error}</div>
            <button
              onClick={() => loadPayments()}
              className="text-blue-600 underline"
            >
              Попробовать снова
            </button>
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
                        {payment.paymentId.slice(0, 8)}...
                      </div>
                      {payment.memo && (
                        <div className="text-xs text-gray-500 mt-1">
                          Memo: {payment.memo.slice(0, 12)}...
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
                      <button
                        onClick={() => {
                          setSelectedPayment(payment)
                          setShowModal(true)
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Управление
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Пагинация */}
      {pagination.pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Показано {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} из {pagination.total}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => loadPayments(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Назад
            </button>
            <span className="px-3 py-1 text-sm">
              Страница {pagination.page} из {pagination.pages}
            </span>
            <button
              onClick={() => loadPayments(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Вперед
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно управления платежом */}
      {showModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Управление платежом</h3>

            <div className="space-y-3 mb-6">
              <div>
                <label className="text-sm font-medium text-gray-700">ID платежа:</label>
                <div className="text-sm text-gray-900 font-mono">{selectedPayment.paymentId}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Пользователь:</label>
                <div className="text-sm text-gray-900">
                  {selectedPayment.user?.firstName} (ID: {selectedPayment.userId})
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Продукт:</label>
                <div className="text-sm text-gray-900">{selectedPayment.product?.name}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Сумма:</label>
                <div className="text-sm text-gray-900 font-medium">
                  {formatPrice(selectedPayment.amount, selectedPayment.currency)}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Текущий статус:</label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedPayment.status)}`}>
                  {getStatusText(selectedPayment.status)}
                </span>
              </div>
              {selectedPayment.memo && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Memo:</label>
                  <div className="text-sm text-gray-900 font-mono">{selectedPayment.memo}</div>
                </div>
              )}
            </div>

            {selectedPayment.status === 'pending' && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">TX Hash (опционально):</label>
                  <input
                    type="text"
                    placeholder="Хеш транзакции"
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="Хеш транзакции"]') as HTMLInputElement
                      handlePaymentAction(selectedPayment.paymentId, 'confirm', input.value)
                    }}
                    disabled={actionLoading}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {actionLoading ? 'Обработка...' : '✅ Подтвердить'}
                  </button>
                  <button
                    onClick={() => handlePaymentAction(selectedPayment.paymentId, 'reject')}
                    disabled={actionLoading}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
                  >
                    {actionLoading ? 'Обработка...' : '❌ Отклонить'}
                  </button>
                </div>
              </div>
            )}

            {selectedPayment.status !== 'pending' && (
              <div className="space-y-3">
                <button
                  onClick={() => handlePaymentAction(selectedPayment.paymentId, 'reset')}
                  disabled={actionLoading}
                  className="w-full bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 disabled:opacity-50 text-sm"
                >
                  {actionLoading ? 'Обработка...' : '🔄 Сбросить в pending'}
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setShowModal(false)
                setSelectedPayment(null)
              }}
              className="w-full mt-4 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}