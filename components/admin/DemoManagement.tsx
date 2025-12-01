'use client'

import { useState, useEffect } from 'react'
import { createAuthenticatedRequest } from '@/utils/telegramAuth'

interface DemoAccess {
  id: string
  userId: string
  productId: string
  startedAt: string
  expiresAt: string
  isActive: boolean
  user: {
    id: string
    firstName: string
    username?: string
  }
  product: {
    productId: string
    name: string
    price: number
    demoDays: number
  }
}

interface Product {
  id: string
  name: string
  price: number
  allowDemo: boolean
  demoDays: number
}

interface DropdownMenuProps {
  demoAccess: DemoAccess
  onExtend: () => void
  onRevoke: () => void
  onDelete: () => void
}

function DropdownMenu({ demoAccess, onExtend, onRevoke, onDelete }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Действия"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
            <button
              onClick={() => {
                onExtend()
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Продлить
            </button>
            <button
              onClick={() => {
                onRevoke()
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Отозвать доступ
            </button>
            <button
              onClick={() => {
                onDelete()
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-100 flex items-center gap-2 border-t border-gray-100"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="font-semibold">Удалить навсегда</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface DemoAccessCardProps {
  demoAccess: DemoAccess
  onExtend: () => void
  onRevoke: () => void
  onDelete: () => void
}

function DemoAccessCard({ demoAccess, onExtend, onRevoke, onDelete }: DemoAccessCardProps) {
  const getDaysRemaining = () => {
    const now = new Date()
    const expiresAt = new Date(demoAccess.expiresAt)
    const diffTime = expiresAt.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  const isDemoActive = () => {
    return demoAccess.isActive && getDaysRemaining() > 0
  }

  const getDaysUsed = () => {
    const startedAt = new Date(demoAccess.startedAt)
    const now = new Date()
    const diffTime = now.getTime() - startedAt.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays)
  }

  const getProgressPercentage = () => {
    return Math.min(100, (getDaysUsed() / demoAccess.product.demoDays) * 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 text-lg">{demoAccess.user.firstName}</h3>
            <span className="text-sm text-gray-500">@{demoAccess.user.username || 'no_username'}</span>
          </div>
          <div className="text-sm font-medium text-blue-600">{demoAccess.product.name}</div>
        </div>
        <DropdownMenu
          demoAccess={demoAccess}
          onExtend={onExtend}
          onRevoke={onRevoke}
          onDelete={onDelete}
        />
      </div>

      {/* Product Info */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div>
            <div className="text-sm font-medium text-gray-900">{demoAccess.product.name}</div>
            <div className="text-xs text-gray-500">${demoAccess.product.price} (полная цена)</div>
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <div className="text-sm font-medium text-gray-900">Период доступа</div>
            <div className="text-xs text-gray-500">
              {formatDate(demoAccess.startedAt)} - {formatDate(demoAccess.expiresAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-600">
            {getDaysUsed()}/{demoAccess.product.demoDays} дней
          </span>
          <span className={`font-medium ${
            getDaysRemaining() <= 3 ? 'text-red-600' : 'text-gray-600'
          }`}>
            {getDaysRemaining()} осталось
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isDemoActive() ? 'bg-blue-600' : 'bg-gray-400'
            }`}
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <button
          onClick={onExtend}
          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
        >
          Продлить
        </button>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
          isDemoActive()
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {isDemoActive() ? 'Активен' : 'Завершен'}
        </span>
      </div>
    </div>
  )
}

export default function DemoManagement() {
  const [demoAccesses, setDemoAccesses] = useState<DemoAccess[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')

  const [newDemoAccess, setNewDemoAccess] = useState({
    userId: '',
    productId: '',
    demoDays: 7
  })

  const [userSearch, setUserSearch] = useState('')
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  // Состояния для модального окна продления
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [selectedDemoId, setSelectedDemoId] = useState('')
  const [selectedDemo, setSelectedDemo] = useState<DemoAccess | null>(null)
  const [extendDate, setExtendDate] = useState('')

  // Состояния для фильтрации
  const [filterUser, setFilterUser] = useState('')
  const [filterProduct, setFilterProduct] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const fetchDemoAccesses = async () => {
    try {
      console.log('🔍 Fetching demo accesses...')
      const response = await fetch('/api/admin/demo/access', createAuthenticatedRequest())

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Demo accesses fetched successfully:', data.demoAccesses?.length || 0, 'demo accesses')
        setDemoAccesses(data.demoAccesses || [])
      } else {
        const error = await response.json()
        console.error('❌ Failed to fetch demo accesses:', error)
      }
    } catch (error) {
      console.error('❌ Error fetching demo accesses:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/admin/products-v2', createAuthenticatedRequest())
      if (response.ok) {
        const data = await response.json()
        // Показываем все активные продукты, т.к. поле allowDemo отсутствует в API
        const activeProducts = data.products?.filter((p: any) => p.isActive) || []
        // Добавляем стандартное количество дней демо для всех продуктов
        const productsWithDemo = activeProducts.map((p: any) => ({
          ...p,
          allowDemo: true, // Предполагаем, что все активные продукты поддерживают демо
          demoDays: 7 // Стандартное значение
        }))
        setProducts(productsWithDemo)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

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

  useEffect(() => {
    fetchDemoAccesses()
    fetchProducts()
  }, [])

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

  const selectUser = (user: any) => {
    setNewDemoAccess({...newDemoAccess, userId: user.telegramId})
    setUserSearch(`${user.firstName} ${user.username ? '@' + user.username : ''}`)
    setShowUserDropdown(false)
  }

  const grantDemoAccess = async () => {
    try {
      console.log('🔍 Granting demo access with data:', newDemoAccess)

      const response = await fetch('/api/admin/demo/grant', createAuthenticatedRequest({
        method: 'POST',
        body: JSON.stringify({
          userId: newDemoAccess.userId,
          productId: newDemoAccess.productId,
          demoDays: newDemoAccess.demoDays
        })
      }))

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Demo access granted successfully:', result)
        setShowGrantModal(false)
        setNewDemoAccess({
          userId: '',
          productId: '',
          demoDays: 7
        })
        fetchDemoAccesses()
      } else {
        const error = await response.json()
        console.error('❌ Demo access grant failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to grant demo access'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error granting demo access:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to grant demo access'}`)
    }
  }

  const revokeDemoAccess = async (demoId: string) => {
    if (!confirm('Вы уверены, что хотите отозвать этот демо-доступ?')) return

    try {
      console.log('🔍 Revoking demo access:', demoId)

      const response = await fetch(`/api/admin/demo/revoke/${demoId}`, createAuthenticatedRequest({
        method: 'DELETE'
      }))

      if (response.ok) {
        console.log('✅ Demo access revoked successfully')
        fetchDemoAccesses()
      } else {
        const error = await response.json()
        console.error('❌ Demo access revocation failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to revoke demo access'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error revoking demo access:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to revoke demo access'}`)
    }
  }

  const openExtendModal = (demoId: string) => {
    const demo = demoAccesses.find(d => d.id === demoId)
    if (demo) {
      setSelectedDemoId(demoId)
      setSelectedDemo(demo)
      // Устанавливаем дату по умолчанию - текущая дата окончания + 7 дней
      const defaultDate = new Date(demo.expiresAt)
      defaultDate.setDate(defaultDate.getDate() + 7)
      setExtendDate(defaultDate.toISOString().split('T')[0]) // формат YYYY-MM-DD для input type="date"
      setShowExtendModal(true)
    }
  }

  const extendDemoAccess = async () => {
    try {
      if (!extendDate) {
        alert('Пожалуйста, выберите дату продления')
        return
      }

      console.log('🔍 Extending demo access:', selectedDemoId, 'to', extendDate)

      const response = await fetch(`/api/admin/demo/extend/${selectedDemoId}`, createAuthenticatedRequest({
        method: 'POST',
        body: JSON.stringify({ newExpiresAt: extendDate })
      }))

      if (response.ok) {
        console.log('✅ Demo access extended successfully')
        setShowExtendModal(false)
        setSelectedDemoId('')
        setSelectedDemo(null)
        setExtendDate('')
        fetchDemoAccesses()
      } else {
        const error = await response.json()
        console.error('❌ Demo access extension failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to extend demo access'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error extending demo access:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to extend demo access'}`)
    }
  }

  const deleteDemoAccess = async (demoId: string) => {
    const confirmation = confirm(
      '⚠️ ВНИМАНИЕ: Это действие безвозвратно удалит демо-доступ!\n\n' +
      'Пользователь будет немедленно удален из канала (если состоит в нем).\n' +
      'Вся информация об этом демо-доступе будет навсегда утеряна.\n\n' +
      'Вы действительно хотите продолжить?'
    )

    if (!confirmation) return

    try {
      console.log('🔍 Deleting demo access:', demoId)

      const response = await fetch(`/api/admin/demo/delete/${demoId}`, createAuthenticatedRequest({
        method: 'DELETE'
      }))

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Demo access deleted successfully:', result)
        alert(`✅ Демо-доступ успешно удален!\n\nПользователь: ${result.deletedDemo.user}\nПродукт: ${result.deletedDemo.product}`)
        fetchDemoAccesses()
      } else {
        const error = await response.json()
        console.error('❌ Demo access deletion failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to delete demo access'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error deleting demo access:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to delete demo access'}`)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU')
  }

  const getDaysRemaining = (demoAccess: DemoAccess) => {
    const now = new Date()
    const expiresAt = new Date(demoAccess.expiresAt)
    const diffTime = expiresAt.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  const isDemoActive = (demoAccess: DemoAccess) => {
    return demoAccess.isActive && getDaysRemaining(demoAccess) > 0
  }

  const getDaysUsed = (demoAccess: DemoAccess) => {
    const startedAt = new Date(demoAccess.startedAt)
    const now = new Date()
    const diffTime = now.getTime() - startedAt.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays)
  }

  // Filtering logic
  const filteredDemoAccesses = demoAccesses.filter(access => {
    // User filter
    const userMatch = filterUser === '' || 
      (access.user.firstName && access.user.firstName.toLowerCase().includes(filterUser.toLowerCase())) ||
      (access.user.username && access.user.username.toLowerCase().includes(filterUser.toLowerCase()))

    // Product filter
    const productMatch = filterProduct === 'all' || access.productId === filterProduct

    // Status filter
    const isActive = isDemoActive(access)
    const statusMatch = filterStatus === 'all' || 
      (filterStatus === 'active' && isActive) ||
      (filterStatus === 'expired' && !isActive)

    return userMatch && productMatch && statusMatch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Загрузка демо-доступов...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Управление демо-доступом</h2>
          <p className="text-sm text-gray-600 mt-1">Бесплатные периоды тестирования для пользователей</p>
        </div>
        <button
          onClick={() => setShowGrantModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 self-start"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Выдать демо-доступ
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* User Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Пользователь</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="Имя или @username"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Product Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Продукт</label>
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">Все продукты</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Статус</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="expired">Завершенные</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Пользователь
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Продукт
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Период
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Прогресс
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDemoAccesses.map((demoAccess) => (
                <tr key={demoAccess.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{demoAccess.user.firstName}</div>
                      <div className="text-sm text-gray-500">@{demoAccess.user.username || 'no_username'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{demoAccess.product.name}</div>
                      <div className="text-sm text-gray-500">${demoAccess.product.price}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {formatDate(demoAccess.startedAt)} - {formatDate(demoAccess.expiresAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-[150px]">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{getDaysUsed(demoAccess)}/{demoAccess.product.demoDays} дней</span>
                        <span className={`font-medium ${
                          getDaysRemaining(demoAccess) <= 3 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {getDaysRemaining(demoAccess)} ост.
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isDemoActive(demoAccess) ? 'bg-blue-600' : 'bg-gray-400'
                          }`}
                          style={{
                            width: `${Math.min(100, (getDaysUsed(demoAccess) / demoAccess.product.demoDays) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openExtendModal(demoAccess.id)}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition-colors"
                      >
                        Продлить
                      </button>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isDemoActive(demoAccess)
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isDemoActive(demoAccess) ? 'Активен' : 'Завершен'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu
                      demoAccess={demoAccess}
                      onExtend={() => openExtendModal(demoAccess.id)}
                      onRevoke={() => revokeDemoAccess(demoAccess.id)}
                      onDelete={() => deleteDemoAccess(demoAccess.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {filteredDemoAccesses.map((demoAccess) => (
          <DemoAccessCard
            key={demoAccess.id}
            demoAccess={demoAccess}
            onExtend={() => openExtendModal(demoAccess.id)}
            onRevoke={() => revokeDemoAccess(demoAccess.id)}
            onDelete={() => deleteDemoAccess(demoAccess.id)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredDemoAccesses.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Ничего не найдено</h3>
          <p className="mt-1 text-sm text-gray-500">Попробуйте изменить параметры фильтрации или выдайте новый доступ</p>
          <div className="mt-6">
            <button
              onClick={() => setShowGrantModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Выдать демо-доступ
            </button>
          </div>
        </div>
      )}

      {/* Grant Demo Access Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Выдать демо-доступ</h3>
            <div className="space-y-4">
              {/* User Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Поиск пользователя *</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Начните вводить имя или username..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value)
                      setShowUserDropdown(true)
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  {userSearchLoading && (
                    <div className="absolute right-3 top-2.5">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    </div>
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

              {/* Selected User Info */}
              {newDemoAccess.userId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-blue-800">
                      Выбран пользователь: {userSearch}
                    </span>
                  </div>
                </div>
              )}

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Выберите продукт *</label>
                <select
                  value={newDemoAccess.productId}
                  onChange={(e) => setNewDemoAccess({...newDemoAccess, productId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Выберите продукт для демо *</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} (${product.price}) - {product.demoDays || 7} дней демо
                    </option>
                  ))}
                </select>
              </div>

              {/* Demo Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Период демо (дни)</label>
                <input
                  type="number"
                  value={newDemoAccess.demoDays}
                  onChange={(e) => setNewDemoAccess({...newDemoAccess, demoDays: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={1}
                  max={30}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowGrantModal(false)
                  setNewDemoAccess({
                    userId: '',
                    productId: '',
                    demoDays: 7
                  })
                  setUserSearch('')
                  setUsers([])
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={grantDemoAccess}
                disabled={!newDemoAccess.userId || !newDemoAccess.productId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
              >
                Выдать демо-доступ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Demo Access Modal */}
      {showExtendModal && selectedDemo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Продлить демо-доступ</h3>

            {/* Demo Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="text-sm">
                <div className="font-medium text-blue-900">
                  {selectedDemo.user.firstName} (@{selectedDemo.user.username || 'no_username'})
                </div>
                <div className="text-blue-700">
                  Продукт: {selectedDemo.product.name}
                </div>
                <div className="text-blue-600 text-xs mt-1">
                  Текущая дата окончания: {new Date(selectedDemo.expiresAt).toLocaleDateString('ru-RU')}
                </div>
              </div>
            </div>

            {/* Date Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Новая дата окончания *
              </label>
              <input
                type="date"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]} // Минимальная дата - сегодня
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <div className="text-xs text-gray-500 mt-1">
                Выберите дату, до которой будет продлен демо-доступ
              </div>
            </div>

            {/* Quick Selection Buttons */}
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Быстрый выбор:</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    const date = new Date()
                    date.setDate(date.getDate() + 7)
                    setExtendDate(date.toISOString().split('T')[0])
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  +7 дней
                </button>
                <button
                  onClick={() => {
                    const date = new Date()
                    date.setDate(date.getDate() + 14)
                    setExtendDate(date.toISOString().split('T')[0])
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  +14 дней
                </button>
                <button
                  onClick={() => {
                    const date = new Date()
                    date.setDate(date.getDate() + 30)
                    setExtendDate(date.toISOString().split('T')[0])
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  +30 дней
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowExtendModal(false)
                  setSelectedDemoId('')
                  setSelectedDemo(null)
                  setExtendDate('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={extendDemoAccess}
                disabled={!extendDate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
              >
                Продлить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}