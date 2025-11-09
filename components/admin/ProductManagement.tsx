'use client'

import { useState, useEffect } from 'react'
import { createAuthenticatedRequest } from '@/utils/telegramAuth'

interface Product {
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
  channelId: string
  channel: {
    channelId: string
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

interface DropdownMenuProps {
  product: Product
  onEdit: () => void
  onDelete: () => void
  onToggleStatus: () => void
}

function DropdownMenu({ product, onEdit, onDelete, onToggleStatus }: DropdownMenuProps) {
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
                onToggleStatus()
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {product.isActive ? 'Деактивировать' : 'Активировать'}
            </button>
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

interface ProductCardProps {
  product: Product
  onEdit: () => void
  onDelete: () => void
  onToggleStatus: () => void
}

function ProductCard({ product, onEdit, onDelete, onToggleStatus }: ProductCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-lg">{product.name}</h3>
          <p className="text-gray-600 text-sm mt-1">{product.description}</p>
        </div>
        <DropdownMenu
          product={product}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleStatus={onToggleStatus}
        />
      </div>

      {/* Price and Status */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1">
          <span className="text-2xl font-bold text-green-600">${product.price}</span>
          <span className="text-gray-500 text-sm">/{product.periodDays}дн</span>
        </div>
        <button
          onClick={onToggleStatus}
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            product.isActive
              ? 'bg-green-100 text-green-800 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {product.isActive ? 'Активен' : 'Неактивен'}
        </button>
      </div>

      {/* Channel Info */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
          </svg>
          <div>
            <div className="font-medium text-gray-900">{product.channel.name}</div>
            <div className="text-xs text-gray-500">ID: {product.channel.channelId}</div>
          </div>
        </div>
      </div>

      {/* Stats and Features */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-sm text-gray-600">{product._count.subscriptions} подписок</span>
          </div>

          {product.allowDemo && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-xs text-blue-600 font-medium">Демо {product.demoDays || 7}дн</span>
            </div>
          )}

          {product.activeDiscounts ? (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-green-600 font-medium">{product.activeDiscounts} скидок</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
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
    channelId: '',
    channelName: '',
    channelUsername: '',
    periodDays: '30',
    isActive: true,
    allowDemo: false,
    demoDays: '7'
  })

  const [editProduct, setEditProduct] = useState({
    name: '',
    description: '',
    price: '',
    channelId: '',
    channelName: '',
    channelUsername: '',
    periodDays: '',
    isActive: true,
    allowDemo: false,
    demoDays: '7'
  })

  // Функция для получения информации о канале по ID
  const fetchChannelInfo = async (channelId: string): Promise<{name: string, username: string | null} | null> => {
    if (!channelId.trim()) return null

    try {
      console.log('🔍 Fetching channel info for ID:', channelId)
      const response = await fetch(`/api/admin/channels/${channelId}`, createAuthenticatedRequest())

      if (response.ok) {
        const data = await response.json()
        if (data.channel) {
          console.log('✅ Found channel:', data.channel.name)
          return {
            name: data.channel.name,
            username: data.channel.username
          }
        }
      }
      return null
    } catch (error) {
      console.error('❌ Error fetching channel info:', error)
      return null
    }
  }

  // Функция для обновления названия канала при изменении ID
  const handleChannelIdChange = async (value: string, isNewProduct = true) => {
    if (isNewProduct) {
      setNewProduct(prev => ({ ...prev, channelId: value }))
    } else {
      setEditProduct(prev => ({ ...prev, channelId: value }))
    }

    if (value.trim()) {
      const channelInfo = await fetchChannelInfo(value.trim())
      if (channelInfo) {
        if (isNewProduct) {
          setNewProduct(prev => ({
            ...prev,
            channelName: channelInfo.name,
            channelUsername: channelInfo.username || ''
          }))
        } else {
          setEditProduct(prev => ({
            ...prev,
            channelName: channelInfo.name,
            channelUsername: channelInfo.username || ''
          }))
        }
      }
    }
  }

  const fetchProducts = async () => {
    try {
      console.log('🔍 Fetching products...')
      const response = await fetch('/api/admin/products', createAuthenticatedRequest())

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

      // API ожидает поле channelTelegramId вместо channelId
      const requestData = {
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        channelTelegramId: newProduct.channelId,
        periodDays: newProduct.periodDays,
        isActive: newProduct.isActive
      }

      const response = await fetch('/api/admin/products', createAuthenticatedRequest({
        method: 'POST',
        body: JSON.stringify(requestData)
      }))

      console.log('🔍 Response status:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Product created successfully:', result)
        setShowCreateModal(false)
        setNewProduct({
          name: '',
          description: '',
          price: '',
          channelId: '',
          channelName: '',
          channelUsername: '',
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
      console.log('🔍 Updating product:', selectedProduct.productId)

      // API ожидает поле channelTelegramId вместо channelId
      const requestData = {
        name: editProduct.name,
        description: editProduct.description,
        price: editProduct.price,
        channelTelegramId: editProduct.channelId,
        periodDays: editProduct.periodDays,
        isActive: editProduct.isActive
      }

      const response = await fetch(`/api/admin/products?id=${selectedProduct.productId}`, createAuthenticatedRequest({
        method: 'PUT',
        body: JSON.stringify(requestData)
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
          channelId: '',
          channelName: '',
          channelUsername: '',
          periodDays: '',
          isActive: true,
          allowDemo: false,
          demoDays: '7'
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

      const response = await fetch(`/api/admin/products?id=${productId}`, createAuthenticatedRequest({
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
      console.log('🔍 Toggling product status:', product.productId, 'to', !product.isActive)

      const response = await fetch(`/api/admin/products?id=${product.productId}`, createAuthenticatedRequest({
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
      channelId: product.channel.channelId,
      channelName: product.channel.name,
      channelUsername: product.channel.username || '',
      periodDays: product.periodDays.toString(),
      isActive: product.isActive,
      allowDemo: product.allowDemo || false,
      demoDays: product.demoDays?.toString() || '7'
    })
    setShowEditModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Загрузка продуктов...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Управление продуктами</h2>
          <p className="text-sm text-gray-600 mt-1">{products.length} {products.length === 1 ? 'продукт' : products.length < 5 ? 'продукта' : 'продуктов'}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 self-start"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Создать продукт
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Продукт
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Канал
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Цена
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Подписки
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product.productId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500 mt-1">{product.description}</div>
                      <div className="flex items-center gap-3 mt-2">
                        {product.allowDemo && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Демо {product.demoDays || 7}дн
                          </span>
                        )}
                        {product.activeDiscounts && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            {product.activeDiscounts} скидок
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-medium">{product.channel.name}</div>
                    <div className="text-xs text-gray-500">ID: {product.channel.channelId}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-semibold text-gray-900">${product.price}</span>
                      <span className="text-xs text-gray-500">/{product.periodDays}дн</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleProductStatus(product)}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        product.isActive
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {product.isActive ? 'Активен' : 'Неактивен'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">{product._count.subscriptions}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu
                      product={product}
                      onEdit={() => openEditModal(product)}
                      onDelete={() => deleteProduct(product.productId)}
                      onToggleStatus={() => toggleProductStatus(product)}
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
        {products.map((product) => (
          <ProductCard
            key={product.productId}
            product={product}
            onEdit={() => openEditModal(product)}
            onDelete={() => deleteProduct(product.productId)}
            onToggleStatus={() => toggleProductStatus(product)}
          />
        ))}
      </div>

      {/* Empty State */}
      {products.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Нет продуктов</h3>
          <p className="mt-1 text-sm text-gray-500">Начните с создания первого продукта</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Создать продукт
            </button>
          </div>
        </div>
      )}

      {/* Create Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-6 text-gray-900">Создать новый продукт</h3>

            <div className="space-y-6">
              {/* Основная информация */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Основная информация</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Название продукта *</label>
                    <input
                      type="text"
                      placeholder="Например: Premium доступ к каналу"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                    <textarea
                      placeholder="Подробное описание продукта и его преимуществ"
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Ценообразование */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Ценообразование</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Цена (USD) *</label>
                    <input
                      type="number"
                      placeholder="10.00"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Длительность (дни) *</label>
                    <input
                      type="number"
                      placeholder="30"
                      value={newProduct.periodDays}
                      onChange={(e) => setNewProduct({...newProduct, periodDays: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                    />
                  </div>
                </div>
              </div>

              {/* Информация о канале */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Информация о Telegram канале</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID канала Telegram *
                      <span className="text-xs text-gray-500 ml-1">(числовой ID без @)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="-1001234567890"
                      value={newProduct.channelId}
                      onChange={(e) => handleChannelIdChange(e.target.value, true)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Название канала определится автоматически по ID
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Название канала
                        <span className="text-xs text-gray-500 ml-1">(авто, можно изменить)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Определится автоматически..."
                        value={newProduct.channelName}
                        onChange={(e) => setNewProduct({...newProduct, channelName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        📝 Можно ввести вручную или оставить автозаполнение
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username канала</label>
                      <input
                        type="text"
                        placeholder="@channel_username"
                        value={newProduct.channelUsername}
                        onChange={(e) => setNewProduct({...newProduct, channelUsername: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Настройки */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Настройки</h4>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newProduct.isActive}
                      onChange={(e) => setNewProduct({...newProduct, isActive: e.target.checked})}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div>
                      <span className="font-medium text-gray-700">Продукт активен</span>
                      <p className="text-sm text-gray-500">Продукт будет доступен для покупки</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={createProduct}
                disabled={!newProduct.name || !newProduct.price || !newProduct.channelId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                Создать продукт
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-6 text-gray-900">Изменить продукт</h3>

            <div className="space-y-6">
              {/* Основная информация */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Основная информация</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Название продукта</label>
                    <input
                      type="text"
                      value={editProduct.name}
                      onChange={(e) => setEditProduct({...editProduct, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                    <textarea
                      value={editProduct.description}
                      onChange={(e) => setEditProduct({...editProduct, description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Ценообразование */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Ценообразование</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Цена (USD)</label>
                    <input
                      type="number"
                      value={editProduct.price}
                      onChange={(e) => setEditProduct({...editProduct, price: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Длительность (дни)</label>
                    <input
                      type="number"
                      value={editProduct.periodDays}
                      onChange={(e) => setEditProduct({...editProduct, periodDays: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                    />
                  </div>
                </div>
              </div>

              {/* Информация о канале */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Информация о Telegram канале</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID канала Telegram
                      <span className="text-xs text-gray-500 ml-1">(числовой ID без @)</span>
                    </label>
                    <input
                      type="text"
                      value={editProduct.channelId}
                      onChange={(e) => handleChannelIdChange(e.target.value, false)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 При изменении ID название обновится автоматически
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Название канала
                        <span className="text-xs text-gray-500 ml-1">(можно изменить)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Текущее название канала..."
                        value={editProduct.channelName}
                        onChange={(e) => setEditProduct({...editProduct, channelName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        📝 Можно изменить вручную или оставить как есть
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username канала</label>
                      <input
                        type="text"
                        value={editProduct.channelUsername}
                        onChange={(e) => setEditProduct({...editProduct, channelUsername: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Настройки */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Настройки</h4>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editProduct.isActive}
                      onChange={(e) => setEditProduct({...editProduct, isActive: e.target.checked})}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div>
                      <span className="font-medium text-gray-700">Продукт активен</span>
                      <p className="text-sm text-gray-500">Продукт будет доступен для покупки</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={updateProduct}
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