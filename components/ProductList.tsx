'use client'

import { useEffect, useState } from 'react'
import { Product } from '@/types'
import { apiRequest, formatPrice, formatTimeLeft } from '@/lib/utils'

interface ProductListProps {
  telegramUser?: any
}

export function ProductList({ telegramUser }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const result = await apiRequest<Product[]>('/api/products')
        if (result.success && result.data) {
          setProducts(result.data)
        } else {
          setError(result.error || 'Ошибка загрузки продуктов')
        }
      } catch (err) {
        setError('Ошибка загрузки продуктов')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProducts()
  }, [])

  const handlePurchase = async (product: Product) => {
    try {
      // Инициация платежа
      const result = await apiRequest('/api/payment/initiate', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.productId
        })
      })

      if (result.success) {
        // Здесь будет логика TON Connect
        alert('Переход к оплате через TON Connect...')
      } else {
        alert(`Ошибка: ${result.error}`)
      }
    } catch (err) {
      alert('Ошибка при инициализации платежа')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="loading-spinner w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600 mb-2">⚠️ {error}</div>
        <button
          onClick={() => window.location.reload()}
          className="text-blue-600 underline"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-2">📦</div>
        <p className="text-gray-600">На данный момент нет доступных подписок</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {products.map((product) => (
        <div key={product.productId} className="subscription-card">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                {product.name}
              </h3>
              {product.description && (
                <p className="text-sm text-gray-600 mb-2">
                  {product.description}
                </p>
              )}
              <div className="flex items-center text-sm text-gray-500">
                <span className="mr-3">📅 {product.periodDays} дней</span>
                {product.isTrial && (
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                    Пробный период
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {product.discountPrice && product.discountPrice < product.price ? (
                <>
                  <span className="price-badge original">
                    {formatPrice(product.price)}
                  </span>
                  <span className="price-badge discount font-bold text-lg">
                    {formatPrice(product.discountPrice)}
                  </span>
                  {product.activeDiscount && (
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                      {product.activeDiscount.type === 'PERCENTAGE'
                        ? `-${product.activeDiscount.value}%`
                        : `-${formatPrice(product.activeDiscount.value)}`}
                      {' '}
                      до {new Date(product.activeDiscount.endDate).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </span>
                  )}
                </>
              ) : (
                <span className="font-bold text-lg text-gray-900">
                  {formatPrice(product.price)}
                </span>
              )}
            </div>

            <button
              onClick={() => handlePurchase(product)}
              className="tg-button text-sm px-4 py-2"
              disabled={!product.isActive}
            >
              {product.isActive ? 'Купить' : 'Недоступно'}
            </button>
          </div>

          {product.channel && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Канал: {product.channel.name}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}