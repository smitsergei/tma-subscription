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

  // Функция получения класса адаптивного статуса
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'pending': return 'status-badge-adaptive pending'
      case 'success': return 'status-badge-adaptive success'
      case 'failed': return 'status-badge-adaptive failed'
      default: return 'status-badge-adaptive pending'
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
      <div className="tg-card-adaptive">
        <div className="text-center">
          <div className="loading-spinner w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="tg-text-secondary">Загрузка платежей...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="tg-card-adaptive">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">⚠️ Ошибка</div>
          <p className="tg-text-secondary mb-3">{error}</p>
          <button
            onClick={() => loadPayments()}
            className="tg-button-adaptive-sm"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="tg-heading-secondary">💳 Мои платежи</h2>

      {/* Фильтры */}
      <div className="tg-card-adaptive p-3">
        <div className="flex items-center gap-3">
          <label className="tg-text-primary text-sm font-medium">Статус:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="tg-select text-sm px-3 py-1"
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
        <div className="tg-card-adaptive">
          <p className="tg-text-secondary text-center">📭 У вас пока нет платежей</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <div key={payment.paymentId} className="tg-card-adaptive">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="tg-text-primary text-sm font-medium">
                      {payment.orderDescription || `Платеж #${payment.paymentId.slice(-8)}`}
                    </h3>
                    <span className={getStatusClass(payment.status)}>
                      {getStatusText(payment.status)}
                    </span>
                  </div>

                  {payment.product && (
                    <p className="tg-text-secondary text-xs mb-1">
                      Продукт: {payment.product.name}
                      {payment.product.channel && (
                        <span className="ml-1">• {payment.product.channel.name}</span>
                      )}
                    </p>
                  )}

                  <p className="tg-text-muted text-xs">
                    Дата создания: {formatDate(payment.createdAt)}
                  </p>
                </div>

                <div className="text-right">
                  <div className="tg-text-primary font-bold">
                    {payment.amount} {payment.currency}
                  </div>
                  {payment.priceAmount && payment.priceCurrency !== payment.currency && (
                    <div className="tg-text-muted text-xs">
                      ~{payment.priceAmount} {payment.priceCurrency}
                    </div>
                  )}
                </div>
              </div>

              {/* Детали платежа для ожидающих */}
              {payment.status === 'pending' && payment.payAddress && (
                <div className="border-t border-gray-300 pt-3 mt-3">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <h4 className="tg-text-primary text-sm font-medium mb-2">🔔 Ожидает оплаты</h4>

                    <div className="space-y-2">
                      {/* Адрес для оплаты */}
                      <div>
                        <label className="tg-text-secondary text-xs font-medium">Адрес для оплаты:</label>
                        <div className="mt-1 p-2 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 break-all font-mono text-xs">
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
                            <span className="tg-text-secondary">Сумма:</span>
                            <div className="tg-text-primary font-medium">
                              {payment.payAmount} {payment.payCurrency}
                            </div>
                          </div>
                          {payment.network && (
                            <div>
                              <span className="tg-text-secondary">Сеть:</span>
                              <div className="tg-text-primary font-medium">{payment.network}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Время до истечения */}
                      {payment.validUntil && (
                        <div className="text-xs">
                          <span className="tg-text-secondary">Время до истечения: </span>
                          <span className="font-medium text-orange-600 dark:text-orange-400">
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
                  className="tg-button-adaptive-sm"
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
            className="tg-button-adaptive-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Назад
          </button>

          <span className="tg-text-muted text-xs">
            Страница {pagination.page} из {pagination.pages}
          </span>

          <button
            onClick={() => loadPayments(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            className="tg-button-adaptive-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Вперед →
          </button>
        </div>
      )}
    </div>
  )
}