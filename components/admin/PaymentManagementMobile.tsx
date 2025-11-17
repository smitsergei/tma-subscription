'use client'

import { useState, useEffect } from 'react'
import { createAuthenticatedRequest } from '@/utils/telegramAuth'
import TelegramMiniAppWrapper, { telegramUtils } from '@/components/ui/TelegramMiniAppWrapper'

// Touch-friendly swipe action hook
function useSwipeAction(onSwipeLeft?: () => void, onSwipeRight?: () => void) {
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)

  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(0)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && onSwipeLeft) {
      telegramUtils.triggerHaptic('selection')
      onSwipeLeft()
    }
    if (isRightSwipe && onSwipeRight) {
      telegramUtils.triggerHaptic('selection')
      onSwipeRight()
    }
  }

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }
}

// Pull-to-refresh hook
function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const onTouchStart = (e: React.TouchEvent) => {
    const scrollTop = (e.target as HTMLElement).scrollTop
    if (scrollTop === 0) {
      setIsPulling(true)
      telegramUtils.triggerHaptic('impact', 'light')
    }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return
    const touch = e.touches[0]
    setPullDistance(Math.min(touch.clientY * 0.5, 120))
  }

  const onTouchEnd = async () => {
    if (!isPulling) return
    setIsPulling(false)

    if (pullDistance > 80 && !isRefreshing) {
      setIsRefreshing(true)
      telegramUtils.triggerHaptic('notification', 'success')
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }
    setPullDistance(0)
  }

  return {
    pullToRefreshProps: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    isRefreshing,
    pullDistance,
  }
}

// Interface definitions
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
  nowPaymentId?: string
  payAddress?: string
  payAmount?: number
  payCurrency?: string
  network?: string
  validUntil?: string
  priceAmount?: number
  priceCurrency?: string
  orderDescription?: string
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

export default function PaymentManagementMobile() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<PaymentsResponse['stats'] | null>(null)

  // Filter states
  const [filters, setFilters] = useState({
    status: '',
    userId: '',
    productId: '',
    search: ''
  })

  // UI states
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'success' | 'failed'>('all')

  // Search states
  const [userSearch, setUserSearch] = useState('')
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  const { pullToRefreshProps, isRefreshing, pullDistance } = usePullToRefresh(async () => {
    await loadPayments(1)
  })

  // Safe formatting functions
  const formatPrice = (price: number, currency: string = 'USDT') => {
    return `${price} ${currency}`
  }

  const formatDate = (date: string | Date) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      if (isNaN(dateObj.getTime())) return 'Некорректная дата'

      const now = new Date()
      const diffMs = now.getTime() - dateObj.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

      if (diffHours < 1) {
        const diffMins = Math.floor(diffMs / (1000 * 60))
        return diffMins <= 1 ? 'Только что' : `${diffMins} мин назад`
      } else if (diffHours < 24) {
        return `${diffHours} ч назад`
      } else {
        return dateObj.toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'short'
        })
      }
    } catch (error) {
      return 'Некорректная дата'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'success': return 'bg-green-100 text-green-800 border-green-200'
      case 'failed': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
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

  // Load payments
  const loadPayments = async (page = 1) => {
    try {
      setLoading(true)
      setError(null)

      if (typeof window === 'undefined') return

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(activeTab !== 'all' && { status: activeTab }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.productId && { productId: filters.productId }),
        ...(filters.search && { search: filters.search })
      })

      const response = await fetch(`/api/admin/payments?${params}`, createAuthenticatedRequest())

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Ошибка загрузки платежей`)
      }

      const data = await response.json()

      if (data.success) {
        setPayments(data.data?.payments || [])
        setStats(data.data?.stats || { total: 0, pending: 0, success: 0, failed: 0 })
        setPagination(data.data?.pagination || { page: 1, limit: 20, total: 0, pages: 0 })
      } else {
        setError(data.error || 'Ошибка загрузки платежей')
      }
    } catch (err) {
      console.error('Load payments error:', err)
      setError(`Ошибка загрузки платежей: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  // Search users
  const fetchUsers = async (searchTerm: string) => {
    try {
      setUserSearchLoading(true)
      const params = new URLSearchParams({
        page: '1',
        limit: '10',
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`/api/admin/users?${params}`, createAuthenticatedRequest())
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setUserSearchLoading(false)
    }
  }

  // Payment action
  const handlePaymentAction = async (paymentId: string, action: 'confirm' | 'reject' | 'reset', txHash?: string) => {
    try {
      setActionLoading(true)

      const response = await fetch('/api/admin/payments', createAuthenticatedRequest({
        method: 'POST',
        body: JSON.stringify({
          paymentId,
          action,
          txHash: action === 'confirm' ? txHash : undefined
        })
      }))

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        telegramUtils.triggerHaptic('notification', 'success')
        telegramUtils.showToast('Операция выполнена успешно')
        setShowModal(false)
        setSelectedPayment(null)
        loadPayments(pagination.page)
      } else {
        telegramUtils.triggerHaptic('notification', 'error')
        setError(data.error || 'Ошибка выполнения действия')
      }
    } catch (err) {
      console.error('PaymentAction error:', err)
      telegramUtils.triggerHaptic('notification', 'error')
      setError(`Ошибка выполнения действия: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Проверка статуса платежа через NOWPayments API
  const handleCheckPaymentStatus = async (paymentId: string) => {
    try {
      setActionLoading(true)

      const response = await fetch('/api/admin/payments', createAuthenticatedRequest({
        method: 'PUT',
        body: JSON.stringify({
          paymentId
        })
      }))

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        telegramUtils.triggerHaptic('notification', 'success')
        alert(data.message || 'Статус платежа обновлен')
        setShowModal(false)
        setSelectedPayment(null)
        loadPayments(pagination.page)
      } else {
        telegramUtils.triggerHaptic('notification', 'error')
        setError(data.error || 'Ошибка проверки статуса')
      }
    } catch (err) {
      console.error('CheckPaymentStatus error:', err)
      telegramUtils.triggerHaptic('notification', 'error')
      setError(`Ошибка проверки статуса: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Массовая проверка статусов всех ожидающих платежей
  const handleCheckAllPendingPayments = async () => {
    try {
      setActionLoading(true)

      const response = await fetch('/api/admin/payments/check-all-pending', createAuthenticatedRequest({
        method: 'POST'
      }))

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        telegramUtils.triggerHaptic('notification', 'success')
        alert(
          `Проверка завершена!\n\n📊 Проверено: ${data.data?.checked || 0}\n✅ Обновлено: ${data.data?.updated || 0}\n\n${data.message || ''}`
        )
        loadPayments(pagination.page)
      } else {
        telegramUtils.triggerHaptic('notification', 'error')
        setError(data.error || 'Ошибка массовой проверки')
      }
    } catch (err) {
      console.error('CheckAllPendingPayments error:', err)
      telegramUtils.triggerHaptic('notification', 'error')
      setError(`Ошибка массовой проверки: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Effects
  useEffect(() => {
    if (typeof window !== 'undefined') {
      loadPayments()
    }
  }, [activeTab, filters, pagination.limit])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (userSearch.trim()) {
        fetchUsers(userSearch)
      } else {
        setUsers([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [userSearch])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.user-search-container')) {
        setShowUserDropdown(false)
      }
    }

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserDropdown])

  const selectUser = (user: any) => {
    telegramUtils.triggerHaptic('selection')
    setFilters({ ...filters, userId: user.telegramId.toString() })
    setUserSearch(`${user.firstName} ${user.username ? '@' + user.username : ''}`)
    setShowUserDropdown(false)
    setShowFilters(false)
  }

  const clearUserFilter = () => {
    telegramUtils.triggerHaptic('selection')
    setFilters({ ...filters, userId: '' })
    setUserSearch('')
    setUsers([])
    setShowUserDropdown(false)
  }

  // Mobile Payment Card Component
  const PaymentCard = ({ payment }: { payment: Payment }) => {
    const swipeProps = useSwipeAction(
      () => { // Swipe left - quick actions
        setSelectedPayment(payment)
        setShowModal(true)
      },
      () => { // Swipe right - copy payment ID
        telegramUtils.requestClipboard(payment.paymentId)
      }
    )

    return (
      <div
        {...swipeProps}
        className="bg-white rounded-xl shadow-sm border border-gray-100 mb-3 overflow-hidden active:scale-[0.98] transition-transform relative group"
      >
        {/* Card Header - Status and Amount */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(payment.status)}`}>
                  {getStatusText(payment.status)}
                </span>
                {payment.status === 'pending' && (
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full animate-pulse">
                    Требует внимания
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatPrice(payment.amount, payment.currency)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">
                {formatDate(payment.createdAt)}
              </div>
              <button
                onClick={() => {
                  telegramUtils.requestClipboard(payment.paymentId)
                }}
                className="text-blue-600 hover:text-blue-700 text-xs font-medium"
              >
                Копировать ID
              </button>
            </div>
          </div>
        </div>

        {/* Card Body - User and Product Info */}
        <div className="p-4 space-y-3">
          {/* User Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                {payment.user?.firstName?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {payment.user?.firstName || 'Unknown User'}
              </div>
              <div className="text-xs text-gray-500">
                ID: {payment.userId}
                {payment.user?.username && ` • @${payment.user.username}`}
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">📦</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {payment.product?.name || 'Unknown Product'}
              </div>
              <div className="text-xs text-gray-500">
                {payment.product?.periodDays || 0} дней
                {payment.product?.channel?.name && ` • ${payment.product.channel.name}`}
              </div>
            </div>
          </div>

          {/* Payment Details - Expandable */}
          {(payment.payAddress || payment.memo) && (
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer text-sm text-gray-600 hover:text-gray-900 list-none">
                <span>Детали платежа</span>
                <svg className="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-100">
                {payment.payAddress && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Адрес для оплаты:</div>
                    <div className="bg-gray-50 p-2 rounded-md">
                      <div className="text-xs font-mono text-gray-900 break-all">
                        {payment.payAddress}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {payment.network && (
                          <span className="text-xs text-gray-500">{payment.network}</span>
                        )}
                        <button
                          onClick={() => {
                            telegramUtils.requestClipboard(payment.payAddress!)
                          }}
                          className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          Копировать
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {payment.memo && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Memo:</div>
                    <div className="bg-gray-50 p-2 rounded-md">
                      <div className="text-xs font-mono text-gray-900">{payment.memo}</div>
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>

        {/* Card Footer - Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          <div className="flex gap-2">
            {payment.status === 'pending' ? (
              <>
                <button
                  onClick={() => {
                    telegramUtils.triggerHaptic('impact', 'medium')
                    setSelectedPayment(payment)
                    setShowModal(true)
                  }}
                  className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors active:scale-[0.98]"
                >
                  Управление
                </button>
                <button
                  onClick={() => {
                    telegramUtils.requestClipboard(payment.payAddress || payment.paymentId)
                  }}
                  className="p-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  telegramUtils.triggerHaptic('impact', 'light')
                  setSelectedPayment(payment)
                  setShowModal(true)
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-gray-300 transition-colors active:scale-[0.98]"
              >
                Детали
              </button>
            )}
          </div>
        </div>

        {/* Swipe indicator */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>
    )
  }

  return (
    <TelegramMiniAppWrapper className="min-h-screen bg-gray-50">
      {/* Pull-to-refresh indicator */}
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 bg-blue-500 text-white p-2 text-center text-sm z-50 flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          Обновление...
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-40">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">💳 Платежи</h1>
            <button
              onClick={() => {
                telegramUtils.triggerHaptic('impact', 'light')
                setShowFilters(!showFilters)
              }}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 mb-4">
            {[
              { id: 'all', label: 'Все', count: stats?.total || 0 },
              { id: 'pending', label: 'Ожидают', count: stats?.pending || 0 },
              { id: 'success', label: 'Успешные', count: stats?.success || 0 },
              { id: 'failed', label: 'Отклонены', count: stats?.failed || 0 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  telegramUtils.triggerHaptic('selection')
                  setActiveTab(tab.id as any)
                }}
                className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Mass Check Button */}
          {(stats && stats.pending > 0) && (
            <div className="mb-4">
              <button
                onClick={handleCheckAllPendingPayments}
                disabled={actionLoading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Проверка...
                  </>
                ) : (
                  <>
                    🔍 Проверить все ожидающие ({stats.pending})
                  </>
                )}
              </button>
            </div>
          )}

          {/* No Pending Message */}
          {stats && stats.pending === 0 && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-center gap-2 text-green-800">
                <span className="text-lg">✅</span>
                <span className="text-sm font-medium">Нет ожидающих платежей</span>
              </div>
            </div>
          )}

          {/* Filters Panel */}
          {showFilters && (
            <div className="space-y-3 p-3 bg-gray-50 rounded-lg -mx-3">
              <div className="relative user-search-container">
                <label className="block text-xs font-medium text-gray-700 mb-1">Пользователь</label>
                <div className="relative">
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value)
                      setShowUserDropdown(true)
                      if (!e.target.value.trim()) {
                        setFilters({ ...filters, userId: '' })
                      }
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    placeholder="Имя или @username"
                    className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {filters.userId && userSearch && (
                    <button
                      type="button"
                      onClick={clearUserFilter}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {showUserDropdown && userSearch.trim() && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {users.length > 0 ? (
                      users.map((user) => (
                        <div
                          key={user.telegramId}
                          onClick={() => selectUser(user)}
                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-medium text-xs">
                                {user.firstName?.[0]?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate text-sm">{user.firstName}</div>
                              <div className="text-xs text-gray-500">
                                @{user.username || 'no_username'} • ID: {user.telegramId}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : !userSearchLoading ? (
                      <div className="px-3 py-4 text-center text-gray-500 text-sm">
                        Пользователи не найдены
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Поиск</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Payment ID, Memo или TX Hash"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {(filters.userId || filters.search) && (
                <button
                  onClick={() => {
                    telegramUtils.triggerHaptic('impact', 'light')
                    setFilters({ status: '', userId: '', productId: '', search: '' })
                    setUserSearch('')
                  }}
                  className="w-full py-2 text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-20" {...pullToRefreshProps}>
        {loading && payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-gray-600 text-sm">Загрузка платежей...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-red-600 mb-2">⚠️ {error}</div>
            <button
              onClick={() => {
                telegramUtils.triggerHaptic('impact', 'medium')
                loadPayments()
              }}
              className="text-red-700 underline text-sm font-medium"
            >
              Попробовать снова
            </button>
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Платежи не найдены</h3>
            <p className="text-gray-600 text-sm">
              {filters.userId || filters.search ? 'Попробуйте изменить фильтры' : 'Платежи пока не были созданы'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <PaymentCard key={payment.paymentId} payment={payment} />
            ))}
          </div>
        )}

        {/* Load More */}
        {pagination.page < pagination.pages && (
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                telegramUtils.triggerHaptic('impact', 'light')
                loadPayments(pagination.page + 1)
              }}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Загрузка...' : `Загрузить еще (${pagination.total - payments.length} осталось)`}
            </button>
          </div>
        )}
      </div>

      {/* Payment Action Modal */}
      {showModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 animate-in fade-in slide-in-from-bottom">
          <div className="bg-white w-full max-h-[90vh] overflow-y-auto rounded-t-2xl animate-in slide-in-from-bottom">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Управление платежом</h3>
                <button
                  onClick={() => {
                    telegramUtils.triggerHaptic('impact', 'light')
                    setShowModal(false)
                    setSelectedPayment(null)
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Payment Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedPayment.status)}`}>
                    {getStatusText(selectedPayment.status)}
                  </span>
                  <div className="text-xl font-bold text-gray-900">
                    {formatPrice(selectedPayment.amount, selectedPayment.currency)}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ID платежа:</span>
                    <span className="font-mono text-gray-900">{selectedPayment.paymentId.slice(0, 12)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Пользователь:</span>
                    <span className="text-gray-900">{selectedPayment.user?.firstName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Продукт:</span>
                    <span className="text-gray-900">{selectedPayment.product?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Создан:</span>
                    <span className="text-gray-900">{formatDate(selectedPayment.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              {selectedPayment.payAddress && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Детали оплаты</label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-blue-700 mb-1">Адрес для оплаты:</div>
                        <div className="font-mono text-sm text-blue-900 break-all bg-white p-2 rounded">
                          {selectedPayment.payAddress}
                        </div>
                      </div>
                      {selectedPayment.network && (
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-700">Сеть:</span>
                          <span className="text-blue-900 font-medium">{selectedPayment.network}</span>
                        </div>
                      )}
                      {selectedPayment.payCurrency && (
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-700">Валюта:</span>
                          <span className="text-blue-900 font-medium">{selectedPayment.payCurrency}</span>
                        </div>
                      )}
                      <button
                        onClick={() => {
                          telegramUtils.requestClipboard(selectedPayment.payAddress!)
                        }}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        📋 Копировать адрес
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedPayment.status === 'pending' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Действия</label>
                  <div className="space-y-3">
                    <div>
                      <input
                        type="text"
                        placeholder="TX Hash (опционально)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        id="txHashInput"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          telegramUtils.triggerHaptic('impact', 'heavy')
                          const input = document.getElementById('txHashInput') as HTMLInputElement
                          handlePaymentAction(selectedPayment.paymentId, 'confirm', input?.value || '')
                        }}
                        disabled={actionLoading}
                        className="bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading ? 'Обработка...' : '✅ Подтвердить'}
                      </button>
                      <button
                        onClick={() => {
                          telegramUtils.triggerHaptic('impact', 'heavy')
                          handlePaymentAction(selectedPayment.paymentId, 'reject')
                        }}
                        disabled={actionLoading}
                        className="bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading ? 'Обработка...' : '❌ Отклонить'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Проверка статуса NOWPayments */}
              {selectedPayment.memo?.includes('NP:') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Проверка статуса</label>
                  <button
                    onClick={() => {
                      telegramUtils.triggerHaptic('impact', 'medium')
                      handleCheckPaymentStatus(selectedPayment.paymentId)
                    }}
                    disabled={actionLoading}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? 'Проверка...' : '🔍 Проверить статус в NOWPayments'}
                  </button>
                </div>
              )}

              {selectedPayment.status !== 'pending' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Действия</label>
                  <button
                    onClick={() => {
                      telegramUtils.triggerHaptic('impact', 'medium')
                      handlePaymentAction(selectedPayment.paymentId, 'reset')
                    }}
                    disabled={actionLoading}
                    className="w-full bg-yellow-600 text-white py-3 rounded-lg font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? 'Обработка...' : '🔄 Сбросить в pending'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </TelegramMiniAppWrapper>
  )
}