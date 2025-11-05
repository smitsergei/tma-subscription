'use client'

import { useState, useEffect } from 'react'

interface Subscription {
  id: string
  status: string
  createdAt: string
  expiresAt: string
  user: {
    id: string
    telegramId: bigint
    firstName: string
    lastName: string
    username: string
  }
  product: {
    id: string
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

      const response = await fetch(`/api/admin/subscriptions?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSubscriptions(data.subscriptions)
        setTotalPages(data.pagination.pages)
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsersAndProducts = async () => {
    try {
      const usersResponse = await fetch('/api/admin/users?limit=100')
      const productsResponse = await fetch('/api/admin/products')

      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setUsers(usersData.users)
      }

      if (productsResponse.ok) {
        const productsData = await productsResponse.json()
        setProducts(productsData.products)
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
      const response = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSubscription)
      })

      if (response.ok) {
        setShowCreateModal(false)
        setNewSubscription({ userId: '', productId: '', status: 'active', expiresAt: '' })
        fetchSubscriptions()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create subscription')
      }
    } catch (error) {
      console.error('Error creating subscription:', error)
      alert('Failed to create subscription')
    }
  }

  const updateSubscription = async () => {
    if (!selectedSubscription) return

    try {
      const response = await fetch(`/api/admin/subscriptions?id=${selectedSubscription.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editSubscription)
      })

      if (response.ok) {
        setShowEditModal(false)
        setSelectedSubscription(null)
        setEditSubscription({ status: '', expiresAt: '' })
        fetchSubscriptions()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update subscription')
      }
    } catch (error) {
      console.error('Error updating subscription:', error)
      alert('Failed to update subscription')
    }
  }

  const deleteSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to delete this subscription?')) return

    try {
      const response = await fetch(`/api/admin/subscriptions?id=${subscriptionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchSubscriptions()
      } else {
        alert('Failed to delete subscription')
      }
    } catch (error) {
      console.error('Error deleting subscription:', error)
      alert('Failed to delete subscription')
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

  if (loading) {
    return <div className="text-center py-8">Loading subscriptions...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">📋 Управление подписками</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          ➕ Создать подписку
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="expired">Истекшие</option>
          <option value="cancelled">Отмененные</option>
        </select>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Пользователь
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Продукт
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Создана
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Истекает
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {subscriptions.map((subscription) => (
                <tr key={subscription.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {subscription.user.firstName} {subscription.user.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        @{subscription.user.username || 'no_username'} ({subscription.user.telegramId.toString()})
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {subscription.product.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        ${subscription.product.price} - {subscription.product.channel.name}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      subscription.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : subscription.status === 'expired'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {subscription.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(subscription.createdAt).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {subscription.expiresAt
                      ? new Date(subscription.expiresAt).toLocaleDateString('ru-RU')
                      : 'Бессрочно'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => openEditModal(subscription)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      ✏️ Изменить
                    </button>
                    <button
                      onClick={() => deleteSubscription(subscription.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      🗑️ Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
          >
            Назад
          </button>
          <span className="px-3 py-1">
            Страница {page} из {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
          >
            Вперед
          </button>
        </div>
      )}

      {/* Create Subscription Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Создать подписку</h3>
            <div className="space-y-4">
              <select
                value={newSubscription.userId}
                onChange={(e) => setNewSubscription({...newSubscription, userId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="active">Активная</option>
                <option value="expired">Истекшая</option>
                <option value="cancelled">Отмененная</option>
              </select>
              <input
                type="date"
                value={newSubscription.expiresAt}
                onChange={(e) => setNewSubscription({...newSubscription, expiresAt: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={createSubscription}
                disabled={!newSubscription.userId || !newSubscription.productId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subscription Modal */}
      {showEditModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Изменить подписку</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пользователь: {selectedSubscription.user.firstName} {selectedSubscription.user.lastName}
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Продукт: {selectedSubscription.product.name}
                </label>
              </div>
              <select
                value={editSubscription.status}
                onChange={(e) => setEditSubscription({...editSubscription, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="active">Активная</option>
                <option value="expired">Истекшая</option>
                <option value="cancelled">Отмененная</option>
              </select>
              <input
                type="date"
                value={editSubscription.expiresAt}
                onChange={(e) => setEditSubscription({...editSubscription, expiresAt: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={updateSubscription}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}