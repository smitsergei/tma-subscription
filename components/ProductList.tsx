'use client'

import { useEffect, useState, useCallback } from 'react'
import { Product, NOWPayment } from '@/types'
import { apiRequest, formatPrice, formatTimeLeft } from '@/lib/utils'
import { useNOWPayments } from '@/hooks/useNOWPayments'

interface ProductListProps {
  telegramUser?: any
}

export function ProductList({ telegramUser }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [purchasingProduct, setPurchasingProduct] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)

  const {
    isLoading: paymentLoading,
    error: paymentError,
    initiatePayment,
    paymentData,
    clearPaymentData
  } = useNOWPayments()

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

  const verifyPayment = useCallback(async (paymentId: string, txHash: string) => {
    try {
      setPaymentStatus('Проверка оплаты...')

      // Для USDT используем специальный эндпоинт верификации
      const result = await fetch('/api/payment/verify-usdt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': window.Telegram?.WebApp?.initData || ''
        },
        body: JSON.stringify({
          paymentId
        })
      }).then(res => res.json())

      if (result.success) {
        setPaymentStatus('✅ Оплата прошла успешно! Подписка активирована.')
        // Обновляем список продуктов, чтобы убрать купленный
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else if (result.needsRetry) {
        // Если оплата еще не пришла, пробуем снова через несколько секунд
        setPaymentStatus('⏳ Ожидание поступления оплаты...')
        setTimeout(() => {
          verifyPayment(paymentId, txHash)
        }, 5000) // Пробуем снова через 5 секунд
      } else {
        setPaymentStatus(`❌ Ошибка: ${result.error}`)
      }
    } catch (err) {
      setPaymentStatus('❌ Ошибка при проверке оплаты')
    } finally {
      if (!paymentStatus.includes('⏳')) {
        setPurchasingProduct(null)
      }
    }
  }, [paymentStatus])

  const handlePurchase = useCallback(async (product: Product) => {
    console.log('🚀 Starting purchase for product:', product.productId)

    setPurchasingProduct(product.productId)
    setPaymentStatus('Создание платежа...')

    try {
      // Определяем итоговую цену
      const finalPrice = product.discountPrice && product.discountPrice < product.price
        ? product.discountPrice
        : product.price

      console.log('💳 Starting NOWPayments payment...')

      // Создаем платеж через NOWPayments
      const paymentResult = await initiatePayment(
        finalPrice,
        'USDT',
        `Оплата подписки: ${product.name}`
      )

      if (paymentResult) {
        console.log('✅ NOWPayment created:', paymentResult)
        setPaymentStatus('✅ Платеж создан! Вы будете перенаправлены на страницу оплаты.')

        // Показываем сообщение об успехе
        alert(`✅ Платеж успешно создан!

📦 ${product.name}
💰 Сумма: ${finalPrice} USD
💳 Вы будете перенаправлены на страницу оплаты NOWPayments

Следуйте инструкциям на странице оплаты для завершения транзакции.`)

        // Очищаем статус через несколько секунд
        setTimeout(() => {
          setPaymentStatus(null)
        }, 5000)
      } else {
        throw new Error('Ошибка создания платежа')
      }
    } catch (err) {
      console.error('❌ Payment error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при оплате'
      setPaymentStatus(`❌ ${errorMessage}`)
      alert(`❌ Ошибка при оформлении подписки: ${errorMessage}`)
    } finally {
      setPurchasingProduct(null)
      setTimeout(() => {
        setPaymentStatus(null)
      }, 3000)
    }
  }, [initiatePayment])

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

  // Индикатор подключения кошелька
  const WalletStatus = () => (
    <div className={`p-3 rounded-lg mb-4 ${
      isConnected
        ? 'bg-green-50 border border-green-200'
        : 'bg-yellow-50 border border-yellow-200'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-yellow-500'
        }`}></div>
        <span className={`text-sm ${
          isConnected ? 'text-green-800' : 'text-yellow-800'
        }`}>
          {isConnected
            ? `Кошелек подключен: ${address?.slice(0, 6)}...${address?.slice(-4)}`
            : 'Кошелек не подключен. Нажмите "Подключить кошелек" для начала.'
          }
        </span>
      </div>
    </div>
  )

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
      <WalletStatus />
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
              className="tg-button text-sm px-4 py-2 flex items-center gap-2"
              disabled={!product.isActive || purchasingProduct === product.productId || paymentLoading}
            >
              {purchasingProduct === product.productId ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Обработка...
                </>
              ) : paymentLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Создание платежа...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Оплатить через NOWPayments
                </>
              )}
            </button>
          </div>

          {/* Статус платежа */}
          {paymentStatus && purchasingProduct === product.productId && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">{paymentStatus}</p>
            </div>
          )}

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