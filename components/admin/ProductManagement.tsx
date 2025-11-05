'use client'

import { useState, useEffect } from 'react'

interface Product {
  id: string
  name: string
  description: string
  price: number
  periodDays: number
  isActive: boolean
  createdAt: string
  channel: {
    id: string
    telegramId: string
    name: string
  }
  _count: {
    subscriptions: number
  }
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
    isActive: true
  })

  const [editProduct, setEditProduct] = useState({
    name: '',
    description: '',
    price: '',
    channelTelegramId: '',
    periodDays: '',
    isActive: true
  })

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/admin/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const createProduct = async () => {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct)
      })

      if (response.ok) {
        setShowCreateModal(false)
        setNewProduct({
          name: '',
          description: '',
          price: '',
          channelTelegramId: '',
          periodDays: '30',
          isActive: true
        })
        fetchProducts()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create product')
      }
    } catch (error) {
      console.error('Error creating product:', error)
      alert('Failed to create product')
    }
  }

  const updateProduct = async () => {
    if (!selectedProduct) return

    try {
      const response = await fetch(`/api/admin/products?id=${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProduct)
      })

      if (response.ok) {
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
        alert(error.error || 'Failed to update product')
      }
    } catch (error) {
      console.error('Error updating product:', error)
      alert('Failed to update product')
    }
  }

  const deleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This will also delete all related subscriptions.')) return

    try {
      const response = await fetch(`/api/admin/products?id=${productId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchProducts()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete product')
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Failed to delete product')
    }
  }

  const toggleProductStatus = async (product: Product) => {
    try {
      const response = await fetch(`/api/admin/products?id=${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !product.isActive })
      })

      if (response.ok) {
        fetchProducts()
      } else {
        alert('Failed to update product status')
      }
    } catch (error) {
      console.error('Error updating product status:', error)
      alert('Failed to update product status')
    }
  }

  const openEditModal = (product: Product) => {
    setSelectedProduct(product)
    setEditProduct({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      channelTelegramId: product.channel.channelId,
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
                      ID: {product.channel.channelId}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${product.price}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {product.periodDays} дней
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
                      className="text-blue-600 hover:text-blue-900"
                    >
                      ✏️ Изменить
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
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
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={createProduct}
                disabled={!newProduct.name || !newProduct.price || !newProduct.channelTelegramId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Создать
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
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={updateProduct}
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