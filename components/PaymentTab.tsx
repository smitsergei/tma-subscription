'use client'

import { useEffect, useState } from 'react'

interface Payment {
  paymentId: string
  userId: string
  amount: number
  currency: string
  status: 'pending' | 'success' | 'failed'
  memo?: string
  createdAt: string
  updatedAt: string
  // NOWPayments fields
  nowPaymentId?: string
  payAddress?: string
  payAmount?: number
  payCurrency?: string
  network?: string
  validUntil?: string
  priceAmount?: number
  priceCurrency?: string
  orderDescription?: string
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

interface PaymentTabProps {
  parseTelegramInitData: () => string | null
}

export default function PaymentTab({ parseTelegramInitData }: PaymentTabProps) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  // Загрузка платежей
  const loadPayments = async (page = 1, status = statusFilter) => {
    try {
      setLoading(true)
      setError(null)

      const webAppData = parseTelegramInitData()
      if (!webAppData) {
        setError('Требуется авторизация через Telegram')
        return
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(status !== 'all' && { status })
      })

      const response = await fetch(`/api/user/payments?initData=${encodeURIComponent(webAppData)}&${params}`)
      const data = await response.json()

      if (data.success) {
        setPayments(data.data.payments)
        setPagination(data.data.pagination)
      } else {
        setError(data.error || 'Ошибка загрузки платежей')
      }
    } catch (err) {
      setError('Ошибка загрузки платежей')
      console.error('Error loading payments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [])

  useEffect(() => {
    loadPayments(1, statusFilter)
  }, [statusFilter])

  // Функция копирования в буфер обмена
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Скопировано в буфер обмена')
    } catch (err) {
      alert('Ошибка копирования')
    }
  }

  // Функция форматирования даты
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Функция получения цвета статуса
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
      case 'pending': return 'Ожидает оплату'
      case 'success': return 'Оплачен'
      case 'failed': return 'Ошибка'
      default: return status
    }
  }

  // Функция открытия деталей платежа
  const openPaymentDetails = (paymentId: string) => {
    window.open(`/payment?payment_id=${paymentId}`, '_blank')
  }

  // Функция расчета оставшегося времени
  const getTimeLeft = (validUntil?: string) => {
    if (!validUntil) return null

    const now = new Date()
    const valid = new Date(validUntil)
    const diff = valid.getTime() - now.getTime()

    if (diff <= 0) return 'Истек'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}ч ${minutes}м`
    }
    return `${minutes}м`
  }

  if (loading && payments.length === 0) {
    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="text-center">
          <div className="loading-spinner w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-gray-500">Загрузка платежей...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">⚠️ Ошибка</div>
          <p className="text-gray-600 mb-3">{error}</p>
          <button
            onClick={() => loadPayments()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">💳 Мои платежи</h2>

      {/* Фильтры */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Статус:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все платежи</option>
            <option value="pending">Ожидают оплату</option>
            <option value="success">Оплачены</option>
            <option value="failed">Ошибка</option>
          </select>
        </div>
      </div>

      {/* Список платежей */}
      {payments.length === 0 ? (
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-gray-500 text-center">📭 У вас пока нет платежей</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <div key={payment.paymentId} className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-gray-900 text-sm">
                      {payment.orderDescription || `Платеж #${payment.paymentId.slice(-8)}`}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                      {getStatusText(payment.status)}
                    </span>
                  </div>

                  {payment.product && (
                    <p className="text-xs text-gray-600 mb-1">
                      Продукт: {payment.product.name}
                      {payment.product.channel && (
                        <span className="ml-1">• {payment.product.channel.name}</span>
                      )}
                    </p>
                  )}

                  <p className="text-xs text-gray-500">
                    Дата создания: {formatDate(payment.createdAt)}
                  </p>
                </div>

                <div className="text-right">
                  <div className="font-bold text-gray-900">
                    {payment.amount} {payment.currency}
                  </div>
                  {payment.priceAmount && payment.priceCurrency !== payment.currency && (
                    <div className="text-xs text-gray-500">
                      ~{payment.priceAmount} {payment.priceCurrency}
                    </div>
                  )}
                </div>
              </div>

              {/* Детали платежа для ожидающих */}
              {payment.status === 'pending' && payment.payAddress && (
                <div className="border-t pt-3 mt-3">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <h4 className="font-medium text-yellow-800 mb-2 text-sm">🔔 Ожидает оплаты</h4>

                    <div className="space-y-2">
                      {/* Адрес для оплаты */}
                      <div>
                        <label className="text-xs font-medium text-gray-700">Адрес для оплаты:</label>
                        <div className="mt-1 p-2 bg-white rounded border break-all font-mono text-xs">
                          {payment.payAddress}
                        </div>
                        <button
                          onClick={() => copyToClipboard(payment.payAddress!)}
                          className="mt-1 text-blue-600 hover:text-blue-800 text-xs underline"
                        >
                          📋 Копировать адрес
                        </button>
                      </div>

                      {/* Сумма и валюта */}
                      {payment.payAmount && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-600">Сумма:</span>
                            <div className="font-medium">
                              {payment.payAmount} {payment.payCurrency}
                            </div>
                          </div>
                          {payment.network && (
                            <div>
                              <span className="text-gray-600">Сеть:</span>
                              <div className="font-medium">{payment.network}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Время до истечения */}
                      {payment.validUntil && (
                        <div className="text-xs">
                          <span className="text-gray-600">Время до истечения: </span>
                          <span className="font-medium text-orange-600">
                            {getTimeLeft(payment.validUntil)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Кнопка действий */}
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => openPaymentDetails(payment.paymentId)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs"
                >
                  📋 Детали платежа
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Пагинация */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-3 pt-2">
          <button
            onClick={() => loadPayments(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-3 py-1 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            ← Назад
          </button>

          <span className="text-xs text-gray-600">
            Страница {pagination.page} из {pagination.pages}
          </span>

          <button
            onClick={() => loadPayments(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className="px-3 py-1 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Вперед →
          </button>
        </div>
      )}
    </div>
  )
}