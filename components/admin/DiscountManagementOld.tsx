'use client'

import { useState, useEffect } from 'react'
import { createAuthenticatedRequest } from '@/utils/telegramAuth'

interface Discount {
  id: string
  productId: string
  type: 'PERCENTAGE' | 'FIXED_AMOUNT'
  value: number
  isActive: boolean
  startDate: string
  endDate: string
  createdAt: string
  updatedAt: string
  product: {
    id: string
    name: string
  }
  _count: {
    usageHistory: number
  }
}

interface Product {
  id: string
  name: string
  price: number
}

export default function DiscountManagement() {
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null)

  const [newDiscount, setNewDiscount] = useState({
    productId: '',
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    value: '',
    isActive: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  })

  const [editDiscount, setEditDiscount] = useState({
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    value: '',
    isActive: true,
    startDate: '',
    endDate: ''
  })

  const fetchDiscounts = async () => {
    try {
      console.log('🔍 Fetching discounts...')
      const response = await fetch('/api/admin/discounts', createAuthenticatedRequest())

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Discounts fetched successfully:', data.discounts?.length || 0, 'discounts')
        setDiscounts(data.discounts || [])
      } else {
        const error = await response.json()
        console.error('❌ Failed to fetch discounts:', error)
      }
    } catch (error) {
      console.error('❌ Error fetching discounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/admin/products-v2', createAuthenticatedRequest())
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  useEffect(() => {
    fetchDiscounts()
    fetchProducts()
  }, [])

  const createDiscount = async () => {
    try {
      console.log('🔍 Creating discount with data:', newDiscount)

      const response = await fetch('/api/admin/discounts', createAuthenticatedRequest({
        method: 'POST',
        body: JSON.stringify({
          ...newDiscount,
          value: parseFloat(newDiscount.value)
        })
      }))

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Discount created successfully:', result)
        setShowCreateModal(false)
        setNewDiscount({
          productId: '',
          type: 'PERCENTAGE',
          value: '',
          isActive: true,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        })
        fetchDiscounts()
      } else {
        const error = await response.json()
        console.error('❌ Discount creation failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to create discount'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error creating discount:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to create discount'}`)
    }
  }

  const updateDiscount = async () => {
    if (!selectedDiscount) return

    try {
      console.log('🔍 Updating discount:', selectedDiscount.id, 'with data:', editDiscount)

      const response = await fetch(`/api/admin/discounts/${selectedDiscount.id}`, createAuthenticatedRequest({
        method: 'PUT',
        body: JSON.stringify({
          ...editDiscount,
          value: parseFloat(editDiscount.value)
        })
      }))

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Discount updated successfully:', result)
        setShowEditModal(false)
        setSelectedDiscount(null)
        setEditDiscount({
          type: 'PERCENTAGE',
          value: '',
          isActive: true,
          startDate: '',
          endDate: ''
        })
        fetchDiscounts()
      } else {
        const error = await response.json()
        console.error('❌ Discount update failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to update discount'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error updating discount:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to update discount'}`)
    }
  }

  const deleteDiscount = async (discountId: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту скидку?')) return

    try {
      console.log('🔍 Deleting discount:', discountId)

      const response = await fetch(`/api/admin/discounts/${discountId}`, createAuthenticatedRequest({
        method: 'DELETE'
      }))

      if (response.ok) {
        console.log('✅ Discount deleted successfully')
        fetchDiscounts()
      } else {
        const error = await response.json()
        console.error('❌ Discount deletion failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to delete discount'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error deleting discount:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to delete discount'}`)
    }
  }

  const toggleDiscountStatus = async (discount: Discount) => {
    try {
      console.log('🔍 Toggling discount status:', discount.id, 'to', !discount.isActive)

      const response = await fetch(`/api/admin/discounts/${discount.id}`, createAuthenticatedRequest({
        method: 'PUT',
        body: JSON.stringify({ isActive: !discount.isActive })
      }))

      if (response.ok) {
        console.log('✅ Discount status updated successfully')
        fetchDiscounts()
      } else {
        const error = await response.json()
        console.error('❌ Discount status update failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to update discount status'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error updating discount status:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to update discount status'}`)
    }
  }

  const openEditModal = (discount: Discount) => {
    setSelectedDiscount(discount)
    setEditDiscount({
      type: discount.type,
      value: discount.value.toString(),
      isActive: discount.isActive,
      startDate: discount.startDate.split('T')[0],
      endDate: discount.endDate.split('T')[0]
    })
    setShowEditModal(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU')
  }

  const isDiscountActive = (discount: Discount) => {
    const now = new Date()
    const startDate = new Date(discount.startDate)
    const endDate = new Date(discount.endDate)
    return discount.isActive && now >= startDate && now <= endDate
  }

  if (loading) {
    return <div className="text-center py-8">Загрузка скидок...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">💰 Управление скидками</h2>
          <p className="text-gray-600 mt-1">Создание и управление скидками на продукты</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
        >
          ➕ Создать скидку
        </button>
      </div>

      {/* Discounts Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Продукт
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Скидка
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Период
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Использований
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {discounts.map((discount) => (
                <tr key={discount.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {discount.product.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {discount.type === 'PERCENTAGE' ? (
                        <span className="text-green-600 font-semibold">-{discount.value}%</span>
                      ) : (
                        <span className="text-blue-600 font-semibold">-${discount.value}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(discount.startDate)} - {formatDate(discount.endDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleDiscountStatus(discount)}
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        isDiscountActive(discount)
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {isDiscountActive(discount) ? '✅ Активна' : '⏸️ Неактивна'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      discount._count.usageHistory > 0
                        ? 'bg-blue-100 text-blue-800 font-semibold'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {discount._count.usageHistory}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => openEditModal(discount)}
                      className="text-indigo-600 hover:text-indigo-900 px-2 py-1 text-sm font-medium"
                    >
                      ✏️ Изменить
                    </button>
                    <button
                      onClick={() => deleteDiscount(discount.id)}
                      className="text-red-600 hover:text-red-900 px-2 py-1 text-sm font-medium"
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

      {/* Create Discount Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Создать скидку</h3>
            <div className="space-y-4">
              <select
                value={newDiscount.productId}
                onChange={(e) => setNewDiscount({...newDiscount, productId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="">Выберите продукт *</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} (${product.price})
                  </option>
                ))}
              </select>

              <select
                value={newDiscount.type}
                onChange={(e) => setNewDiscount({...newDiscount, type: e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT'})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="PERCENTAGE">Процентная скидка</option>
                <option value="FIXED_AMOUNT">Фиксированная скидка</option>
              </select>

              <input
                type="number"
                placeholder={newDiscount.type === 'PERCENTAGE' ? "Процент скидки *" : "Сумма скидки ($)"}
                value={newDiscount.value}
                onChange={(e) => setNewDiscount({...newDiscount, value: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min={newDiscount.type === 'PERCENTAGE' ? 1 : 0}
                max={newDiscount.type === 'PERCENTAGE' ? 100 : undefined}
                step={newDiscount.type === 'PERCENTAGE' ? 1 : 0.01}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
                  <input
                    type="date"
                    value={newDiscount.startDate}
                    onChange={(e) => setNewDiscount({...newDiscount, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания</label>
                  <input
                    type="date"
                    value={newDiscount.endDate}
                    onChange={(e) => setNewDiscount({...newDiscount, endDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newDiscount.isActive}
                  onChange={(e) => setNewDiscount({...newDiscount, isActive: e.target.checked})}
                  className="mr-2"
                />
                Скидка активна
              </label>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Отмена
              </button>
              <button
                onClick={createDiscount}
                disabled={!newDiscount.productId || !newDiscount.value}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                ✅ Создать скидку
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Discount Modal */}
      {showEditModal && selectedDiscount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Изменить скидку</h3>
            <div className="space-y-4">
              <select
                value={editDiscount.type}
                onChange={(e) => setEditDiscount({...editDiscount, type: e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT'})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="PERCENTAGE">Процентная скидка</option>
                <option value="FIXED_AMOUNT">Фиксированная скидка</option>
              </select>

              <input
                type="number"
                placeholder={editDiscount.type === 'PERCENTAGE' ? "Процент скидки" : "Сумма скидки ($)"}
                value={editDiscount.value}
                onChange={(e) => setEditDiscount({...editDiscount, value: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min={editDiscount.type === 'PERCENTAGE' ? 1 : 0}
                max={editDiscount.type === 'PERCENTAGE' ? 100 : undefined}
                step={editDiscount.type === 'PERCENTAGE' ? 1 : 0.01}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
                  <input
                    type="date"
                    value={editDiscount.startDate}
                    onChange={(e) => setEditDiscount({...editDiscount, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания</label>
                  <input
                    type="date"
                    value={editDiscount.endDate}
                    onChange={(e) => setEditDiscount({...editDiscount, endDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={editDiscount.isActive}
                  onChange={(e) => setEditDiscount({...editDiscount, isActive: e.target.checked})}
                  className="mr-2"
                />
                Скидка активна
              </label>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Отмена
              </button>
              <button
                onClick={updateDiscount}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                💾 Сохранить изменения
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}