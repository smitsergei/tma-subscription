'use client'

import { useState, useEffect } from 'react'
import { createAuthenticatedRequest } from '@/utils/telegramAuth'

interface Product {
  id: string
  productId: string
  name: string
  description: string
  price: number
  periodDays: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  discountPrice?: number
  isTrial?: boolean
  allowDemo?: boolean
  demoDays?: number
  channel: {
    id: string
    name: string
    username?: string
    description?: string
    createdAt: string
  }
  _count: {
    subscriptions: number
  }
  activeDiscounts?: number
}

export default function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    channelTelegramId: '',
    periodDays: '30',
    isActive: true,
    allowDemo: false,
    demoDays: '7'
  })

  const [editProduct, setEditProduct] = useState({
    name: '',
    description: '',
    price: '',
    channelTelegramId: '',
    periodDays: '',
    isActive: true,
    allowDemo: false,
    demoDays: '7'
  })

  const fetchProducts = async () => {
    try {
      console.log('🔍 Fetching products...')
      const response = await fetch('/api/admin/products-v2', createAuthenticatedRequest())

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Products fetched successfully:', data.products?.length || 0, 'products')
        setProducts(data.products || [])
      } else {
        const error = await response.json()
        console.error('❌ Failed to fetch products:', error)
      }
    } catch (error) {
      console.error('❌ Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const createProduct = async () => {
    try {
      console.log('🔍 Creating product with data:', newProduct)

      const response = await fetch('/api/admin/products-v2', createAuthenticatedRequest({
        method: 'POST',
        body: JSON.stringify(newProduct)
      }))

      console.log('🔍 Response status:', response.status)
      console.log('🔍 Response headers:', response.headers)

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Product created successfully:', result)
        setShowCreateModal(false)
        setNewProduct({
          name: '',
          description: '',
          price: '',
          channelTelegramId: '',
          periodDays: '30',
          isActive: true,
          allowDemo: false,
          demoDays: '7'
        })
        fetchProducts()
      } else {
        const error = await response.json()
        console.error('❌ Product creation failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to create product'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error creating product:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to create product'}`)
    }
  }

  const updateProduct = async () => {
    if (!selectedProduct) return

    try {
      console.log('🔍 Updating product:', selectedProduct.id, 'with data:', editProduct)

      const response = await fetch(`/api/admin/products-v2?id=${selectedProduct.id}`, createAuthenticatedRequest({
        method: 'PUT',
        body: JSON.stringify(editProduct)
      }))

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Product updated successfully:', result)
        setShowEditModal(false)
        setSelectedProduct(null)
        setEditProduct({
          name: '',
          description: '',
          price: '',
          channelTelegramId: '',
          periodDays: '',
          isActive: true
        })
        fetchProducts()
      } else {
        const error = await response.json()
        console.error('❌ Product update failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to update product'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error updating product:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to update product'}`)
    }
  }

  const deleteProduct = async (productId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот продукт? Это также удалит все связанные подписки.')) return

    try {
      console.log('🔍 Deleting product:', productId)

      const response = await fetch(`/api/admin/products-v2?id=${productId}`, createAuthenticatedRequest({
        method: 'DELETE'
      }))

      if (response.ok) {
        console.log('✅ Product deleted successfully')
        fetchProducts()
      } else {
        const error = await response.json()
        console.error('❌ Product deletion failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to delete product'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error deleting product:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to delete product'}`)
    }
  }

  const toggleProductStatus = async (product: Product) => {
    try {
      console.log('🔍 Toggling product status:', product.id, 'to', !product.isActive)

      const response = await fetch(`/api/admin/products-v2?id=${product.id}`, createAuthenticatedRequest({
        method: 'PUT',
        body: JSON.stringify({ isActive: !product.isActive })
      }))

      if (response.ok) {
        console.log('✅ Product status updated successfully')
        fetchProducts()
      } else {
        const error = await response.json()
        console.error('❌ Product status update failed:', error)
        alert(`Ошибка: ${error.error || 'Failed to update product status'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('❌ Error updating product status:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to update product status'}`)
    }
  }

  const openEditModal = (product: Product) => {
    setSelectedProduct(product)
    setEditProduct({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      channelTelegramId: product.channel.id,
      periodDays: product.periodDays.toString(),
      isActive: product.isActive
    })
    setShowEditModal(true)
  }

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">📦 Управление продуктами</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          ➕ Создать продукт
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Продукт
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Канал
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Цена
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Длительность
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Скидки
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Демо
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Подписки
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {product.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {product.channel.name}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {product.channel.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${product.price}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.periodDays} дней
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {product.activeDiscounts ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✅ {product.activeDiscounts} активных
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        ➕ Нет скидок
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {product.allowDemo ? (
                      <div className="flex flex-col">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          🎓 {product.demoDays || 7} дней
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                        ❌ Недоступно
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleProductStatus(product)}
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        product.isActive
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {product.isActive ? 'Активен' : 'Неактивен'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product._count.subscriptions}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => openEditModal(product)}
                      className="text-indigo-600 hover:text-indigo-900 px-2 py-1 text-sm font-medium"
                    >
                      ✏️ Изменить
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
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

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Создать продукт</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Название продукта *"
                value={newProduct.name}
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <textarea
                placeholder="Описание"
                value={newProduct.description}
                onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
              />
              <input
                type="number"
                placeholder="Цена (USD) *"
                value={newProduct.price}
                onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                step="0.01"
              />
              <input
                type="text"
                placeholder="ID канала Telegram *"
                value={newProduct.channelTelegramId}
                onChange={(e) => setNewProduct({...newProduct, channelTelegramId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Длительность (дни)"
                value={newProduct.periodDays}
                onChange={(e) => setNewProduct({...newProduct, periodDays: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min="1"
              />
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newProduct.isActive}
                  onChange={(e) => setNewProduct({...newProduct, isActive: e.target.checked})}
                  className="mr-2"
                />
                Продукт активен
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
                onClick={createProduct}
                disabled={!newProduct.name || !newProduct.price || !newProduct.channelTelegramId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                ✅ Создать продукт
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Изменить продукт</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Название продукта"
                value={editProduct.name}
                onChange={(e) => setEditProduct({...editProduct, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <textarea
                placeholder="Описание"
                value={editProduct.description}
                onChange={(e) => setEditProduct({...editProduct, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
              />
              <input
                type="number"
                placeholder="Цена (USD)"
                value={editProduct.price}
                onChange={(e) => setEditProduct({...editProduct, price: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                step="0.01"
              />
              <input
                type="text"
                placeholder="ID канала Telegram"
                value={editProduct.channelTelegramId}
                onChange={(e) => setEditProduct({...editProduct, channelTelegramId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                placeholder="Длительность (дни)"
                value={editProduct.periodDays}
                onChange={(e) => setEditProduct({...editProduct, periodDays: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min="1"
              />
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={editProduct.isActive}
                  onChange={(e) => setEditProduct({...editProduct, isActive: e.target.checked})}
                  className="mr-2"
                />
                Продукт активен
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
                onClick={updateProduct}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
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