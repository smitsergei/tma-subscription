'use client'

import { useState, useEffect } from 'react'
import { createAuthenticatedRequest } from '@/utils/telegramAuth'

// Безопасная обертка для функций, которые могут вызывать ошибки
function safeExecute<T>(fn: () => T, fallback: T, errorContext: string): T {
  try {
    const result = fn()
    console.log(`🔍 SAFE EXECUTE: ${errorContext} - Success`)
    return result
  } catch (error) {
    console.error(`🔍 SAFE EXECUTE: ${errorContext} - Error:`, error)
    return fallback
  }
}

// Безопасное создание состояния с fallback значениями
function createSafeState() {
  console.log('🔍 SAFE STATE: Creating initial safe state...')
  return {
    payments: [] as any[],
    loading: true,
    error: null as string | null,
    filters: {
      status: '',
      userId: '',
      productId: '',
      search: ''
    },
    pagination: {
      page: 1,
      limit: 50,
      total: 0,
      pages: 0
    },
    stats: {
      total: 0,
      pending: 0,
      success: 0,
      failed: 0
    },
    selectedPayment: null as any,
    showModal: false,
    actionLoading: false
  }
}

// Безопасные функции форматирования
function safeFormatPrice(price: number, currency: string = 'USDT'): string {
  try {
    return `${price} ${currency}`
  } catch (error) {
    console.error('🔍 SAFE FORMAT: Price formatting error:', error)
    return `${price || 0} ${currency}`
  }
}

function safeFormatDate(date: string | Date): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date')
    }
    return dateObj.toLocaleDateString('ru-RU')
  } catch (error) {
    console.error('🔍 SAFE FORMAT: Date formatting error:', error)
    return 'Некорректная дата'
  }
}

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

export default function PaymentManagement() {
  console.log('🔍 PaymentManagement: Component initializing...')

  // Используем безопасную инициализацию состояния
  const safeState = createSafeState()
  const [payments, setPayments] = useState<Payment[]>(safeState.payments)
  const [loading, setLoading] = useState<boolean>(safeState.loading)
  const [error, setError] = useState<string | null>(safeState.error)
  const [stats, setStats] = useState<PaymentsResponse['stats'] | null>(null)

  console.log('🔍 PaymentManagement: Basic state initialized safely')

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

  // Состояние для поиска пользователей
  const [userSearch, setUserSearch] = useState('')
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  // Загрузка платежей
  const loadPayments = async (page = 1) => {
    try {
      console.log('🔍 loadPayments: Starting payment load...', { page, filters })
      setLoading(true)
      setError(null)

      // Проверяем доступность функций
      if (typeof window === 'undefined') {
        console.log('🔍 loadPayments: Running on server, skipping')
        return
      }

      console.log('🔍 loadPayments: Window available, URL:', window.location?.href)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.productId && { productId: filters.productId }),
        ...(filters.search && { search: filters.search })
      })

      console.log('🔍 loadPayments: Request params:', params.toString())

      // Проверяем аутентификацию перед запросом
      let authRequest
      try {
        authRequest = createAuthenticatedRequest()
        console.log('🔍 loadPayments: Auth request created successfully')
        console.log('🔍 loadPayments: Auth headers:', authRequest.headers)
      } catch (authError) {
        console.error('🔍 loadPayments: Error creating auth request:', authError)
        throw new Error(`Ошибка аутентификации: ${authError instanceof Error ? authError.message : 'Неизвестная ошибка'}`)
      }

      console.log('🔍 loadPayments: Making fetch request to /api/admin/payments')

      const response = await fetch(`/api/admin/payments?${params}`, authRequest)

      console.log('🔍 loadPayments: Response status:', response.status)
      console.log('🔍 loadPayments: Response headers:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        console.log('🔍 loadPayments: Response not OK, reading error text...')
        const errorText = await response.text()
        console.log('🔍 loadPayments: Error response text:', errorText)
        throw new Error(`HTTP ${response.status}: ${errorText || 'Server error'}`)
      }

      console.log('🔍 loadPayments: Parsing JSON response...')

      let data
      try {
        const text = await response.text()
        console.log('🔍 loadPayments: Raw response text:', text.substring(0, 200) + '...')
        data = JSON.parse(text)
      } catch (parseError) {
        console.error('🔍 loadPayments: JSON parse error:', parseError)
        throw new Error('Ошибка парсинга ответа сервера')
      }

      console.log('🔍 loadPayments: Parsed data structure:', {
        hasSuccess: 'success' in data,
        success: data.success,
        hasData: 'data' in data,
        dataType: typeof data.data
      })

      if (data.success) {
        console.log('🔍 loadPayments: Success, setting payments:', data.data?.payments?.length)
        console.log('🔍 loadPayments: Payments sample:', data.data?.payments?.slice(0, 2))

        if (data.data?.payments) {
          setPayments(data.data.payments)
          setStats(data.data.stats || { total: 0, pending: 0, success: 0, failed: 0 })
          setPagination(data.data.pagination || { page: 1, limit: 50, total: 0, pages: 0 })
        } else {
          console.warn('🔍 loadPayments: No payments in response data')
          setPayments([])
          setStats({ total: 0, pending: 0, success: 0, failed: 0 })
          setPagination({ page: 1, limit: 50, total: 0, pages: 0 })
        }
      } else {
        console.log('🔍 loadPayments: API returned error:', data.error)
        setError(data.error || 'Ошибка загрузки платежей')
      }
    } catch (err) {
      console.error('🔍 PaymentManagement: Load payments error:', err)
      console.error('🔍 PaymentManagement: Error type:', typeof err)
      console.error('🔍 PaymentManagement: Error message:', err instanceof Error ? err.message : String(err))
      setError(`Ошибка загрузки платежей: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }

  // Поиск пользователей
  const fetchUsers = async (searchTerm: string) => {
    try {
      setUserSearchLoading(true)
      const params = new URLSearchParams({
        page: '1',
        limit: '20',
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

  // Действие с платежом
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
        setShowModal(false)
        setSelectedPayment(null)
        loadPayments(pagination.page) // Перезагрузка списка
      } else {
        setError(data.error || 'Ошибка выполнения действия')
      }
    } catch (err) {
      console.error('PaymentAction error:', err)
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
        alert(data.message || 'Статус платежа обновлен')
        setShowModal(false)
        setSelectedPayment(null)
        loadPayments(pagination.page) // Перезагрузка списка
      } else {
        setError(data.error || 'Ошибка проверки статуса')
      }
    } catch (err) {
      console.error('CheckPaymentStatus error:', err)
      setError(`Ошибка проверки статуса: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    } finally {
      setActionLoading(false)
    }
  }

  // Первоначальная загрузка
  useEffect(() => {
    console.log('🔍 PaymentManagement: Component mounting...')

    // Добавляем задержку для гарантии загрузки Telegram WebApp
    const timer = setTimeout(() => {
      console.log('🔍 PaymentManagement: Timer triggered, starting loadPayments...')

      // Проверяем доступность окружения
      if (typeof window === 'undefined') {
        console.log('🔍 PaymentManagement: Server-side rendering, skipping loadPayments')
        return
      }

      console.log('🔍 PaymentManagement: Client-side, URL:', window.location?.href)
      console.log('🔍 PaymentManagement: Telegram WebApp available:', !!(window as any).Telegram?.WebApp)

      try {
        loadPayments()
      } catch (error) {
        console.error('🔍 PaymentManagement: Error in useEffect loadPayments:', error)
        console.error('🔍 PaymentManagement: Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined
        })

        setError(`Ошибка инициализации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)

        // Устанавливаем пустые данные для предотвращения ошибок рендера
        setPayments([])
        setStats({ total: 0, pending: 0, success: 0, failed: 0 })
        setPagination({ page: 1, limit: 50, total: 0, pages: 0 })
      }
    }, 100) // Небольшая задержка для инициализации Telegram WebApp

    return () => {
      console.log('🔍 PaymentManagement: Component unmounting, clearing timer')
      clearTimeout(timer)
    }
  }, [])

  // Обработка фильтров
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadPayments(1)
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [filters, pagination.limit])

  // Поиск пользователей
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

  // Закрытие dropdown при клике вне компонента
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
    setFilters({ ...filters, userId: user.telegramId.toString() })
    setUserSearch(`${user.firstName} ${user.username ? '@' + user.username : ''}`)
    setShowUserDropdown(false)
  }

  const clearUserFilter = () => {
    setFilters({ ...filters, userId: '' })
    setUserSearch('')
    setUsers([])
    setShowUserDropdown(false)
  }

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

  // Если есть критическая ошибка, показываем ее
  if (error && !loading) {
    console.log('🔍 PaymentManagement: Rendering error state:', error)
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">💳 Управление платежами</h1>
          <p className="text-gray-600">Просмотр и управление всеми платежами системы</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">⚠️ Ошибка загрузки</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => {
              console.log('🔍 PaymentManagement: Retry button clicked')
              setError(null)
              loadPayments(1)
            }}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            🔄 Попробовать снова
          </button>
        </div>
      </div>
    )
  }

  console.log('🔍 PaymentManagement: Rendering main component, loading:', loading, 'payments count:', payments?.length)

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
          <div className="relative user-search-container">
            <label className="block text-sm font-medium text-gray-700 mb-1">ID пользователя</label>
            <div className="relative">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value)
                  setShowUserDropdown(true)
                  // Если поле очистили, также очищаем фильтр
                  if (!e.target.value.trim()) {
                    setFilters({ ...filters, userId: '' })
                  }
                }}
                onFocus={() => setShowUserDropdown(true)}
                placeholder="Начните вводить имя или username..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {userSearchLoading && (
                <div className="absolute right-3 top-2.5">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
              )}
              {filters.userId && userSearch && (
                <button
                  type="button"
                  onClick={clearUserFilter}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* User Dropdown */}
            {showUserDropdown && userSearch.trim() && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {users.length > 0 ? (
                  users.map((user) => (
                    <div
                      key={user.telegramId}
                      onClick={() => selectUser(user)}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-medium text-sm">
                            {user.firstName?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{user.firstName}</div>
                          <div className="text-sm text-gray-500">
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
                    Payin Address
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
                {safeExecute(() => payments.map((payment) => (
                  <tr key={payment?.paymentId || 'unknown'} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">
                        {safeExecute(() => (payment?.paymentId || 'unknown').slice(0, 8), 'unknown', 'paymentId slice')}...
                      </div>
                      {payment?.memo && (
                        <div className="text-xs text-gray-500 mt-1">
                          Memo: {safeExecute(() => payment.memo.slice(0, 12), '...', 'memo slice')}...
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payment?.user?.firstName || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">
                        ID: {payment?.userId || 'unknown'}
                        {payment?.user?.username && ` (@${payment.user.username})`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payment?.product?.name || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {payment?.product?.periodDays || 0} дней
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {safeExecute(() => safeFormatPrice(payment?.amount || 0, payment?.currency || 'USDT'), '0 USDT', 'formatPrice')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payment?.payAddress ? (
                        <div className="text-sm">
                          <div className="text-gray-900 font-mono">
                            {payment.payAddress.slice(0, 12)}...
                          </div>
                          {payment?.network && (
                            <div className="text-xs text-gray-500 mt-1">
                              {payment.network}
                            </div>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(payment.payAddress || '')
                                .then(() => alert('Адрес скопирован в буфер обмена'))
                                .catch(() => alert('Ошибка копирования'))
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs underline"
                          >
                            📋 Копировать
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          Нет адреса
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${safeExecute(() => getStatusColor(payment?.status || 'unknown'), 'bg-gray-100 text-gray-800', 'getStatusColor')}`}>
                        {safeExecute(() => getStatusText(payment?.status || 'unknown'), 'Unknown', 'getStatusText')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {safeExecute(() => safeFormatDate(payment?.createdAt || new Date()), 'Некорректная дата', 'formatDate')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => safeExecute(() => {
                          console.log('🔍 PaymentManagement: Management button clicked for payment:', payment?.paymentId)
                          setSelectedPayment(payment)
                          setShowModal(true)
                        }, undefined, 'setSelectedPayment')}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Управление
                      </button>
                    </td>
                  </tr>
                )), [], 'Error rendering payments list')}
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
                <div className="text-sm text-gray-900 font-mono">{selectedPayment?.paymentId || 'unknown'}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Пользователь:</label>
                <div className="text-sm text-gray-900">
                  {selectedPayment?.user?.firstName || 'Unknown'} (ID: {selectedPayment?.userId || 'unknown'})
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Продукт:</label>
                <div className="text-sm text-gray-900">{selectedPayment?.product?.name || 'Unknown'}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Сумма:</label>
                <div className="text-sm text-gray-900 font-medium">
                  {safeExecute(() => safeFormatPrice(selectedPayment?.amount || 0, selectedPayment?.currency || 'USDT'), '0 USDT', 'formatPrice')}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Текущий статус:</label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${safeExecute(() => getStatusColor(selectedPayment?.status || 'unknown'), 'bg-gray-100 text-gray-800', 'getStatusColor')}`}>
                  {safeExecute(() => getStatusText(selectedPayment?.status || 'unknown'), 'Unknown', 'getStatusText')}
                </span>
              </div>
              {selectedPayment?.memo && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Memo:</label>
                  <div className="text-sm text-gray-900 font-mono">{selectedPayment.memo}</div>
                </div>
              )}
              {selectedPayment?.payAddress && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Payin Address:</label>
                  <div className="text-sm text-gray-900">
                    <div className="font-mono break-all bg-gray-50 p-2 rounded">
                      {selectedPayment.payAddress}
                    </div>
                    <div className="mt-1 space-y-1">
                      {selectedPayment?.network && (
                        <div className="text-xs text-gray-500">
                          Сеть: {selectedPayment.network}
                        </div>
                      )}
                      <div className="text-xs text-gray-500">
                        Валюта: {selectedPayment.payCurrency || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        Сумма: {selectedPayment.payAmount || 'N/A'} {selectedPayment.payCurrency || ''}
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedPayment.payAddress || '')
                            .then(() => alert('Адрес скопирован в буфер обмена'))
                            .catch(() => alert('Ошибка копирования'))
                        }}
                        className="text-blue-600 hover:text-blue-800 text-xs underline"
                      >
                        📋 Копировать адрес
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {selectedPayment?.nowPaymentId && (
                <div>
                  <label className="text-sm font-medium text-gray-700">NOWPayments ID:</label>
                  <div className="text-sm text-gray-900 font-mono">{selectedPayment.nowPaymentId}</div>
                </div>
              )}
              {selectedPayment?.validUntil && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Действует до:</label>
                  <div className="text-sm text-gray-900">
                    {safeExecute(() => safeFormatDate(selectedPayment.validUntil!), 'Некорректная дата', 'formatDate')}
                  </div>
                </div>
              )}
            </div>

            {selectedPayment?.status === 'pending' && (
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
                      handlePaymentAction(selectedPayment?.paymentId || '', 'confirm', input?.value || '')
                    }}
                    disabled={actionLoading}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {actionLoading ? 'Обработка...' : '✅ Подтвердить'}
                  </button>
                  <button
                    onClick={() => handlePaymentAction(selectedPayment?.paymentId || '', 'reject')}
                    disabled={actionLoading}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
                  >
                    {actionLoading ? 'Обработка...' : '❌ Отклонить'}
                  </button>
                </div>
              </div>
            )}

            {/* Проверка статуса через NOWPayments API - доступна для всех платежей с NP */}
            {selectedPayment?.memo?.includes('NP:') && (
              <div className="space-y-3">
                <button
                  onClick={() => handleCheckPaymentStatus(selectedPayment?.paymentId || '')}
                  disabled={actionLoading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {actionLoading ? 'Проверка...' : '🔍 Проверить статус в NOWPayments'}
                </button>
              </div>
            )}

            {selectedPayment?.status !== 'pending' && (
              <div className="space-y-3">
                <button
                  onClick={() => handlePaymentAction(selectedPayment?.paymentId || '', 'reset')}
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