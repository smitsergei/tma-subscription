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
    id: string
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

export default function DemoManagement() {
  const [demoAccesses, setDemoAccesses] = useState<DemoAccess[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')

  const [newDemoAccess, setNewDemoAccess] = useState({
    userId: '',
    productId: '',
    demoDays: 7
  })

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
        setProducts(data.products?.filter((p: any) => p.allowDemo) || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  useEffect(() => {
    fetchDemoAccesses()
    fetchProducts()
  }, [])

  const grantDemoAccess = async () => {
    try {
      console.log('🔍 Granting demo access with data:', newDemoAccess)

      const response = await fetch('/api/admin/demo/grant', createAuthenticatedRequest({
        method: 'POST',
        body: JSON.stringify({
          userId: BigInt(newDemoAccess.userId),
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

  const extendDemoAccess = async (demoId: string, additionalDays: number) => {
    try {
      console.log('🔍 Extending demo access:', demoId, 'by', additionalDays, 'days')

      const response = await fetch(`/api/admin/demo/extend/${demoId}`, createAuthenticatedRequest({
        method: 'POST',
        body: JSON.stringify({ additionalDays })
      }))

      if (response.ok) {
        console.log('✅ Demo access extended successfully')
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

  if (loading) {
    return <div className="text-center py-8">Загрузка демо-доступов...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">🎓 Управление демо-доступом</h2>
          <p className="text-gray-600 mt-1">Бесплатные периоды тестирования для пользователей</p>
        </div>
        <button
          onClick={() => setShowGrantModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          ➕ Выдать демо-доступ
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-blue-500 rounded-lg p-3">
              <span className="text-white text-xl">🎓</span>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Всего демо-доступов</div>
              <div className="text-2xl font-semibold text-gray-900">{demoAccesses.length}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-green-500 rounded-lg p-3">
              <span className="text-white text-xl">✅</span>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Активные демо</div>
              <div className="text-2xl font-semibold text-gray-900">
                {demoAccesses.filter(d => isDemoActive(d)).length}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 bg-orange-500 rounded-lg p-3">
              <span className="text-white text-xl">⏰</span>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-500">Истекают сегодня</div>
              <div className="text-2xl font-semibold text-gray-900">
                {demoAccesses.filter(d => isDemoActive(d) && getDaysRemaining(d) === 1).length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Accesses Table */}
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
                  Период
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Прогресс
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {demoAccesses.map((demoAccess) => (
                <tr key={demoAccess.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {demoAccess.user.firstName}
                      </div>
                      <div className="text-gray-500">
                        @{demoAccess.user.username || 'no_username'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {demoAccess.product.name}
                      </div>
                      <div className="text-gray-500">
                        ${demoAccess.product.price} (полная цена)
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(demoAccess.startedAt)} - {formatDate(demoAccess.expiresAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="max-w-[150px]">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{getDaysUsed(demoAccess)}/{demoAccess.product.demoDays} дней</span>
                        <span>{getDaysRemaining(demoAccess)} осталось</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            isDemoActive(demoAccess) ? 'bg-blue-600' : 'bg-gray-400'
                          }`}
                          style={{
                            width: `${Math.min(100, (getDaysUsed(demoAccess) / demoAccess.product.demoDays) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => extendDemoAccess(demoAccess.id, 7)}
                        className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                      >
                        +7 дней
                      </button>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        isDemoActive(demoAccess)
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {isDemoActive(demoAccess) ? '✅ Активен' : '⏸️ Завершен'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => revokeDemoAccess(demoAccess.id)}
                      className="text-red-600 hover:text-red-900 px-2 py-1 text-sm font-medium"
                    >
                      🗑️ Отозвать
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant Demo Access Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Выдать демо-доступ</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID пользователя Telegram *</label>
                <input
                  type="text"
                  placeholder="Например: 123456789"
                  value={newDemoAccess.userId}
                  onChange={(e) => setNewDemoAccess({...newDemoAccess, userId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Используйте Telegram ID пользователя</p>
              </div>

              <select
                value={newDemoAccess.productId}
                onChange={(e) => setNewDemoAccess({...newDemoAccess, productId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="">Выберите продукт для демо *</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} (${product.price}) - {product.demoDays} дней демо
                  </option>
                ))}
              </select>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Период демо (дни)</label>
                <input
                  type="number"
                  value={newDemoAccess.demoDays}
                  onChange={(e) => setNewDemoAccess({...newDemoAccess, demoDays: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Отмена
              </button>
              <button
                onClick={grantDemoAccess}
                disabled={!newDemoAccess.userId || !newDemoAccess.productId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                ✅ Выдать демо-доступ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}