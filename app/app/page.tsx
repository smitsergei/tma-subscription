'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNOWPayments } from '@/hooks/useNOWPayments'
import PaymentTab from '@/components/PaymentTab'

// Функция для извлечения данных из URL
function parseTelegramData() {
  if (typeof window === 'undefined') return null

  const urlParams = new URLSearchParams(window.location.hash.slice(1))
  const webAppData = urlParams.get('tgWebAppData')

  if (!webAppData) return null

  try {
    const params = new URLSearchParams(webAppData)
    const userStr = params.get('user')

    if (!userStr) return null

    const user = JSON.parse(decodeURIComponent(userStr))
    return user
  } catch (error) {
    console.error('Error parsing Telegram data:', error)
    return null
  }
}

export default function TmaPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [userSubscriptions, setUserSubscriptions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'products' | 'subscriptions' | 'payments'>('products')
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)

  // NOWPayments integration
  const {
    isLoading: paymentLoading,
    error: paymentError,
    initiatePayment,
    paymentData,
    clearPaymentData
  } = useNOWPayments()

  // Функция для загрузки продуктов
  const loadProducts = async () => {
    try {
      setProductsLoading(true)
      console.log('🔍 Loading products from API...')

      const response = await fetch('/api/products')
      const data = await response.json()

      console.log('🔍 Products API response:', data)

      if (data.success) {
        setProducts(data.data)
        console.log(`✅ Loaded ${data.data.length} products`)
      } else {
        console.error('❌ Products API error:', data.error)
      }
    } catch (error) {
      console.error('❌ Error loading products:', error)
    } finally {
      setProductsLoading(false)
    }
  }

  // Функция для загрузки подписок пользователя
  const loadUserSubscriptions = async () => {
    try {
      setSubscriptionsLoading(true)
      console.log('🔍 Loading user subscriptions...')

      // Получаем Telegram init данные из URL
      const webAppData = parseTelegramInitData()

      const response = await fetch('/api/user/subscriptions' + (webAppData ? `?initData=${encodeURIComponent(webAppData)}` : ''))
      const data = await response.json()

      console.log('🔍 User subscriptions API response:', data)

      if (data.success) {
        setUserSubscriptions(data.data)
        console.log(`✅ Loaded ${data.data.length} user subscriptions`)
      } else {
        console.error('❌ User subscriptions API error:', data.error)
        // Если API требует авторизации, попробуем использовать debug endpoint
        console.log('🔄 Trying debug endpoint...')
        await loadUserSubscriptionsFromDebug()
      }
    } catch (error) {
      console.error('❌ Error loading user subscriptions:', error)
      // Пробуем debug endpoint при ошибке
      await loadUserSubscriptionsFromDebug()
    } finally {
      setSubscriptionsLoading(false)
    }
  }

  // Функция для получения Telegram init данных
  const parseTelegramInitData = () => {
    if (typeof window === 'undefined') return null

    const urlParams = new URLSearchParams(window.location.hash.slice(1))
    const webAppData = urlParams.get('tgWebAppData')
    return webAppData
  }

  // Загрузка подписок через debug endpoint (для тестирования)
  const loadUserSubscriptionsFromDebug = async () => {
    try {
      console.log('🔄 Loading subscriptions from debug endpoint...')

      const response = await fetch('/api/debug/test-subscription')
      const data = await response.json()

      console.log('🔍 Debug subscriptions API response:', data)

      if (data.success) {
        // Фильтруем только активные подписки
        const activeSubscriptions = data.data.filter((sub: any) => sub.status === 'active')
        setUserSubscriptions(activeSubscriptions)
        console.log(`✅ Loaded ${activeSubscriptions.length} active subscriptions from debug`)
      }
    } catch (error) {
      console.error('❌ Error loading debug subscriptions:', error)
    }
  }

  // Функция для обработки покупки
  const handlePurchase = async (product: any) => {
    try {
      console.log('🛒 Starting purchase for product:', product.productId)
      setPurchaseLoading(product.productId)

      // Определяем итоговую цену
      const finalPrice = product.discountPrice && product.discountPrice < product.price
        ? product.discountPrice
        : product.price

      // Получаем Telegram init данные
      const webAppData = parseTelegramInitData()
      if (!webAppData) {
        alert('❌ Ошибка: не удалось получить данные Telegram')
        return
      }

      console.log('🔄 Initiating NOWPayment...')

      // Создаем платеж через NOWPayments
      const paymentResult = await initiatePayment(
        finalPrice,
        'USDT',
        `Оплата подписки: ${product.name}`,
        product.productId
      )

      if (!paymentResult) {
        throw new Error('Ошибка создания платежа')
      }

      console.log('✅ NOWPayment created:', paymentResult)

      // Показываем информацию об успешном создании платежа
      alert(`✅ Платеж создан!

📦 ${product.name}
💰 Сумма: ${finalPrice} USD
💳 Вы будете перенаправлены на страницу оплаты NOWPayments

Следуйте инструкциям на странице оплаты для завершения транзакции.`)

      // Обновляем список подписок после небольшой задержки
      setTimeout(() => {
        if (activeTab === 'subscriptions') {
          loadUserSubscriptions()
        }
      }, 5000)

    } catch (error) {
      console.error('❌ Purchase error:', error)
      alert(`❌ Ошибка при оформлении подписки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setPurchaseLoading(null)
    }
  }

  
  useEffect(() => {
    const initData = parseTelegramData()

    if (initData) {
      setUser(initData)
      console.log('✅ User data parsed from URL:', initData)
      console.log('🔗 Environment URL:', process.env.NEXT_PUBLIC_APP_URL)
      // Загружаем продукты после получения данных пользователя
      loadProducts()
      // Загружаем подписки пользователя
      loadUserSubscriptions()
    } else {
      console.log('❌ No Telegram data found in URL')
      console.log('🔗 Environment URL:', process.env.NEXT_PUBLIC_APP_URL)
    }

    setIsLoading(false)
  }, [])

  // Загружаем подписки когда переключаемся на вкладку
  useEffect(() => {
    if (activeTab === 'subscriptions' && user) {
      loadUserSubscriptions()
    }
  }, [activeTab, user])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="loading-spinner w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Ошибка доступа</div>
          <p className="text-gray-600">Не удалось получить данные пользователя Telegram</p>
          <p className="text-gray-500 text-sm mt-2">Пожалуйста, откройте приложение через бота в мобильном Telegram</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen tg-app">
      {/* Header */}
      <div className="tg-header sticky top-0 z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            Привет, {user?.first_name || 'Пользователь'}! 👋
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex mt-3 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'products'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🛍️ Подписки
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'subscriptions'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Мои подписки
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'payments'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            💳 Платежи
          </button>
        </div>

        </div>

      {/* Debug Panel (только для разработки) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="px-4 py-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <h4 className="font-medium text-yellow-800 mb-2">🔧 Отладка NOWPayments:</h4>
            <div className="space-y-1 text-xs">
              <div>Loading: {paymentLoading ? 'Yes ⏳' : 'No'}</div>
              <div>Error: {paymentError || 'None'}</div>
              <div>Payment Data: {paymentData ? `ID: ${paymentData.payment_id}` : 'None'}</div>
              <button
                onClick={() => {
                  console.log('🔧 Debug: NOWPayments data')
                  console.log('Payment loading:', paymentLoading)
                  console.log('Payment error:', paymentError)
                  console.log('Payment data:', paymentData)
                  console.log('Environment variables:', {
                    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
                    NODE_ENV: process.env.NODE_ENV
                  })
                }}
                className="mt-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded"
              >
                Проверить console.log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-4">
        {activeTab === 'products' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">🛍️ Доступные подписки</h2>

            {productsLoading ? (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-center">
                  <div className="loading-spinner w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-gray-500">Загрузка подписок...</p>
                </div>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-500 text-center">😕 Нет доступных подписок</p>
                <p className="text-gray-400 text-sm text-center mt-1">Попробуйте обновить страницу</p>
              </div>
            ) : (
              <>
                {products.map((product) => (
                  <div key={product.productId} className="bg-white rounded-lg p-4 border border-gray-200">
                    <h3 className="font-medium text-gray-900">{product.name}</h3>
                    <p className="text-gray-600 text-sm mt-1">{product.description}</p>
                    {product.channel && (
                      <p className="text-gray-500 text-xs mt-1">📢 {product.channel.name}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <div>
                        {product.discountPrice && product.discountPrice < product.price ? (
                          <>
                            <span className="text-lg font-bold text-blue-600">${product.discountPrice.toFixed(2)}</span>
                            <span className="text-sm text-gray-500 line-through ml-2">${product.price.toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-lg font-bold text-blue-600">${product.price.toFixed(2)}</span>
                        )}
                        <span className="text-xs text-gray-500 ml-1">/{product.periodDays}дней</span>
                      </div>
                      <button
                        onClick={() => handlePurchase(product)}
                        disabled={purchaseLoading === product.productId || paymentLoading}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          purchaseLoading === product.productId || paymentLoading
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                      >
                        {purchaseLoading === product.productId
                          ? '⏳ Оплата...'
                          : paymentLoading
                            ? '🔄 Создание платежа...'
                            : '💳 Купить'
                        }
                      </button>
                    </div>
                  </div>
                ))}
                <div className="text-center text-gray-500 text-sm mt-4 space-y-1">
                  <div>💳 Оплата через NOWPayments</div>
                  <div className="text-xs text-gray-400">
                    Поддерживаем Bitcoin, Ethereum, USDT, USDC и другие криптовалюты
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {activeTab === 'subscriptions' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">📋 Мои подписки</h2>

            {subscriptionsLoading ? (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-center">
                  <div className="loading-spinner w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                  <p className="text-gray-500">Загрузка подписок...</p>
                </div>
              </div>
            ) : userSubscriptions.length === 0 ? (
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-500 text-center">У вас пока нет активных подписок</p>
                <p className="text-gray-400 text-sm text-center mt-1">
                  🛍️ Перейдите в "Подписки", чтобы оформить доступ к контенту
                </p>
              </div>
            ) : (
              <>
                {userSubscriptions.map((subscription) => (
                  <div key={subscription.subscriptionId} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{subscription.product?.name || 'Подписка'}</h3>
                        {subscription.product?.channel && (
                          <p className="text-gray-500 text-sm mt-1">
                            📢 {subscription.product.channel.name}
                          </p>
                        )}
                        <p className="text-gray-500 text-xs mt-2">
                          📅 Истекает: {new Date(subscription.expiresAt).toLocaleDateString('ru-RU')}
                        </p>
                        <p className="text-gray-500 text-xs">
                          Осталось дней: {subscription.daysRemaining || Math.ceil((new Date(subscription.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
                        </p>
                      </div>
                      <div className={`ml-4 px-2 py-1 text-xs font-medium rounded-full ${
                        subscription.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {subscription.status === 'active' ? '✅ Активна' : '❌ Истекла'}
                      </div>
                    </div>
                    {subscription.status === 'active' && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors">
                          🔄 Продлить
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
        {activeTab === 'payments' && (
          <PaymentTab parseTelegramInitData={parseTelegramInitData} />
        )}
      </div>
    </div>
  )
}