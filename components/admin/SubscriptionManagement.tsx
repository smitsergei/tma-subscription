'use client'

import { useState, useEffect } from 'react'
import { createAuthenticatedRequest } from '@/utils/telegramAuth'

interface Subscription {
  subscriptionId: string
  status: string
  createdAt: string
  expiresAt: string
  user: {
    telegramId: string
    firstName: string
    username: string
  }
  product: {
    productId: string
    name: string
    price: number
    channel: {
      telegramId: string
      name: string
    }
  }
  payment?: {
    amount: number
    status: string
  }
}

interface DropdownMenuProps {
  subscription: Subscription
  onEdit: () => void
  onDelete: () => void
}

function DropdownMenu({ subscription, onEdit, onDelete }: DropdownMenuProps) {
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
                onEdit()
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Изменить
            </button>
            <button
              onClick={() => {
                onDelete()
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Удалить
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface SubscriptionCardProps {
  subscription: Subscription
  onEdit: () => void
  onDelete: () => void
}

function SubscriptionCard({ subscription, onEdit, onDelete }: SubscriptionCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 hover:bg-green-200'
      case 'expired':
        return 'bg-red-100 text-red-800 hover:bg-red-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      default:
        return 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Активна'
      case 'expired':
        return 'Истекла'
      case 'cancelled':
        return 'Отменена'
      default:
        return status
    }
  }

  const isExpiringSoon = subscription.expiresAt &&
    new Date(subscription.expiresAt) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
    subscription.status === 'active'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg">{subscription.product.name}</h3>
          <p className="text-gray-600 text-sm mt-1">
            {subscription.user.firstName}
          </p>
        </div>
        <DropdownMenu
          subscription={subscription}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      {/* Status */}
      <div className="flex items-center gap-4 mb-3">
        <button
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-colors ${getStatusColor(subscription.status)}`}
        >
          {getStatusText(subscription.status)}
        </button>
        {isExpiringSoon && (
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
            Истекает скоро
          </span>
        )}
      </div>

      {/* User Info */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <div>
            <div className="font-medium text-gray-900">
              @{subscription.user.username || 'no_username'}
            </div>
            <div className="text-xs text-gray-500">ID: {subscription.user.telegramId.toString()}</div>
          </div>
        </div>
      </div>

      {/* Product and Dates */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Цена:</span>
          <span className="font-medium text-gray-900">${subscription.product.price}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Канал:</span>
          <span className="font-medium text-gray-900">{subscription.product.channel.name}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Создана:</span>
          <span className="text-gray-600">
            {new Date(subscription.createdAt).toLocaleDateString('ru-RU')}
          </span>
        </div>
        {subscription.expiresAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Истекает:</span>
            <span className={`font-medium ${
              isExpiringSoon ? 'text-orange-600' : 'text-gray-600'
            }`}>
              {new Date(subscription.expiresAt).toLocaleDateString('ru-RU')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SubscriptionManagement() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null)
  const [users, setUsers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  const [newSubscription, setNewSubscription] = useState({
    userId: '',
    productId: '',
    status: 'active',
    expiresAt: ''
  })

  const [editSubscription, setEditSubscription] = useState({
    status: '',
    expiresAt: ''
  })

  const fetchSubscriptions = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status })
      })

      const response = await fetch(`/api/admin/subscriptions?${params}`, createAuthenticatedRequest())
      if (response.ok) {
        const data = await response.json()
        setSubscriptions(data.subscriptions || [])
        setTotalPages(data.pagination?.pages || 1)
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsersAndProducts = async () => {
    try {
      const usersResponse = await fetch('/api/admin/users?limit=100', createAuthenticatedRequest())
      const productsResponse = await fetch('/api/admin/products-v2', createAuthenticatedRequest())

      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setUsers(usersData.users || [])
      }

      if (productsResponse.ok) {
        const productsData = await productsResponse.json()
        setProducts(productsData.products || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  useEffect(() => {
    fetchSubscriptions()
    fetchUsersAndProducts()
  }, [page, status])

  const createSubscription = async () => {
    try {
      const response = await fetch('/api/admin/subscriptions', createAuthenticatedRequest({
        method: 'POST',
        body: JSON.stringify(newSubscription)
      }))

      if (response.ok) {
        setShowCreateModal(false)
        setNewSubscription({ userId: '', productId: '', status: 'active', expiresAt: '' })
        fetchSubscriptions()
      } else {
        const error = await response.json()
        alert(`Ошибка: ${error.error || 'Failed to create subscription'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('Error creating subscription:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to create subscription'}`)
    }
  }

  const updateSubscription = async () => {
    if (!selectedSubscription) return

    try {
      const response = await fetch(`/api/admin/subscriptions?id=${selectedSubscription.subscriptionId}`, createAuthenticatedRequest({
        method: 'PUT',
        body: JSON.stringify(editSubscription)
      }))

      if (response.ok) {
        setShowEditModal(false)
        setSelectedSubscription(null)
        setEditSubscription({ status: '', expiresAt: '' })
        fetchSubscriptions()
      } else {
        const error = await response.json()
        alert(`Ошибка: ${error.error || 'Failed to update subscription'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('Error updating subscription:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to update subscription'}`)
    }
  }

  const deleteSubscription = async (subscriptionId: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту подписку?')) return

    try {
      const response = await fetch(`/api/admin/subscriptions?id=${subscriptionId}`, createAuthenticatedRequest({
        method: 'DELETE'
      }))

      if (response.ok) {
        fetchSubscriptions()
      } else {
        const error = await response.json()
        alert(`Ошибка: ${error.error || 'Failed to delete subscription'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('Error deleting subscription:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to delete subscription'}`)
    }
  }

  const openEditModal = (subscription: Subscription) => {
    setSelectedSubscription(subscription)
    setEditSubscription({
      status: subscription.status,
      expiresAt: subscription.expiresAt ? new Date(subscription.expiresAt).toISOString().split('T')[0] : ''
    })
    setShowEditModal(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 hover:bg-green-200'
      case 'expired':
        return 'bg-red-100 text-red-800 hover:bg-red-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      default:
        return 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Активна'
      case 'expired':
        return 'Истекла'
      case 'cancelled':
        return 'Отменена'
      default:
        return status
    }
  }

  const isExpiringSoon = (subscription: Subscription) => {
    return subscription.expiresAt &&
      new Date(subscription.expiresAt) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
      subscription.status === 'active'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Загрузка подписок...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Управление подписками</h2>
          <p className="text-sm text-gray-600 mt-1">{subscriptions.length} {subscriptions.length === 1 ? 'подписка' : subscriptions.length < 5 ? 'подписки' : 'подписок'}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 self-start"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Создать подписку
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="expired">Истекшие</option>
          <option value="cancelled">Отмененные</option>
        </select>
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
                  Статус
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Срок действия
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {subscriptions.map((subscription) => (
                <tr key={subscription.subscriptionId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {subscription.user.firstName}
                      </div>
                      <div className="text-sm text-gray-500">
                        @{subscription.user.username || 'no_username'} ({subscription.user.telegramId.toString()})
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">
                        {subscription.product.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        ${subscription.product.price} • {subscription.product.channel.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-colors ${getStatusColor(subscription.status)}`}
                      >
                        {getStatusText(subscription.status)}
                      </button>
                      {isExpiringSoon(subscription) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                          Истекает скоро
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="text-gray-600">
                        Создана: {new Date(subscription.createdAt).toLocaleDateString('ru-RU')}
                      </div>
                      {subscription.expiresAt && (
                        <div className={`font-medium ${isExpiringSoon(subscription) ? 'text-orange-600' : 'text-gray-900'}`}>
                        Истекает: {new Date(subscription.expiresAt).toLocaleDateString('ru-RU')}
                      </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu
                      subscription={subscription}
                      onEdit={() => openEditModal(subscription)}
                      onDelete={() => deleteSubscription(subscription.subscriptionId)}
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
        {subscriptions.map((subscription) => (
          <SubscriptionCard
            key={subscription.subscriptionId}
            subscription={subscription}
            onEdit={() => openEditModal(subscription)}
            onDelete={() => deleteSubscription(subscription.subscriptionId)}
          />
        ))}
      </div>

      {/* Empty State */}
      {subscriptions.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Нет подписок</h3>
          <p className="mt-1 text-sm text-gray-500">Начните с создания первой подписки</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Создать подписку
            </button>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="px-4 py-2 text-sm text-gray-700">
            Страница {page} из {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Create Subscription Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Создать подписку</h3>
            <div className="space-y-4">
              <select
                value={newSubscription.userId}
                onChange={(e) => setNewSubscription({...newSubscription, userId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Выберите пользователя</option>
                {users.map((user) => (
                  <option key={user.id} value={user.telegramId.toString()}>
                    {user.firstName} {user.lastName} (@{user.username})
                  </option>
                ))}
              </select>
              <select
                value={newSubscription.productId}
                onChange={(e) => setNewSubscription({...newSubscription, productId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Выберите продукт</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - ${product.price}
                  </option>
                ))}
              </select>
              <select
                value={newSubscription.status}
                onChange={(e) => setNewSubscription({...newSubscription, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Активная</option>
                <option value="expired">Истекшая</option>
                <option value="cancelled">Отмененная</option>
              </select>
              <input
                type="date"
                value={newSubscription.expiresAt}
                onChange={(e) => setNewSubscription({...newSubscription, expiresAt: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={createSubscription}
                disabled={!newSubscription.userId || !newSubscription.productId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subscription Modal */}
      {showEditModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Изменить подписку</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600">
                  <div className="mb-1">
                    <span className="font-medium">Пользователь:</span> {selectedSubscription.user.firstName}
                  </div>
                  <div>
                    <span className="font-medium">Продукт:</span> {selectedSubscription.product.name}
                  </div>
                </div>
              </div>
              <select
                value={editSubscription.status}
                onChange={(e) => setEditSubscription({...editSubscription, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="active">Активная</option>
                <option value="expired">Истекшая</option>
                <option value="cancelled">Отмененная</option>
              </select>
              <input
                type="date"
                value={editSubscription.expiresAt}
                onChange={(e) => setEditSubscription({...editSubscription, expiresAt: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={updateSubscription}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Сохранить изменения
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}