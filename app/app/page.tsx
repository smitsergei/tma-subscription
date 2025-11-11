'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNOWPayments } from '@/hooks/useNOWPayments'
import PaymentTab from '@/components/PaymentTab'
import CurrencyNetworkModal from '@/components/CurrencyNetworkModal'
import SupportPage from '@/components/SupportPage'

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
  const [activeTab, setActiveTab] = useState<'products' | 'subscriptions' | 'payments' | 'support'>('support')
const [isFirstVisit, setIsFirstVisit] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)
  const [demoLoading, setDemoLoading] = useState<string | null>(null)
  const [showCurrencyModal, setShowCurrencyModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)

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
  const handlePurchase = (product: any) => {
    console.log('🛒 Starting purchase for product:', product.productId)
    setSelectedProduct(product)
    setShowCurrencyModal(true)
  }

  // Функция для обработки запроса демо-доступа
  const handleDemoRequest = async (product: any) => {
    try {
      setDemoLoading(product.productId)
      console.log('🚀 Starting demo request for product:', product.productId)

      // Получаем Telegram init данные
      const webAppData = parseTelegramInitData()
      if (!webAppData) {
        alert('❌ Ошибка: не удалось получить данные Telegram')
        return
      }

      console.log('🔄 Sending demo request...')

      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': webAppData
        },
        body: JSON.stringify({
          productId: product.productId
        })
      })

      const result = await response.json()
      console.log('🔍 Demo API response:', result)

      if (response.ok && result.success) {
        // Демо-доступ успешно создан
        alert(`✅ Демо-доступ успешно оформлен!

📦 ${product.name}
⏰ Длительность: ${product.demoDays} дней
📅 Действует до: ${new Date(result.demoAccess.expiresAt).toLocaleDateString('ru-RU')}

Наслаждайтесь бесплатным доступом!`)

        // Обновляем список подписок после небольшой задержки
        setTimeout(() => {
          if (activeTab === 'subscriptions') {
            loadUserSubscriptions()
          }
        }, 2000)

      } else {
        // Обработка ошибок
        if (response.status === 400 && result.demoAccess) {
          alert(`📋 У вас уже есть активный демо-доступ!

📦 ${product.name}
⏰ Осталось дней: ${result.demoAccess.daysRemaining}
📅 Истекает: ${new Date(result.demoAccess.expiresAt).toLocaleDateString('ru-RU')}

Используйте текущий демо-доступ или оформите полную подписку.`)
        } else {
          alert(`❌ Ошибка при оформлении демо-доступа: ${result.error || 'Неизвестная ошибка'}`)
        }
      }

    } catch (error) {
      console.error('❌ Demo request error:', error)
      alert(`❌ Ошибка при оформлении демо-доступа: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setDemoLoading(null)
    }
  }

  // Функция для подтверждения покупки с выбранной валютой, сетью и промокодом
  const handleConfirmPurchase = async (currency: string, network: string, promoCodeId?: string) => {
    if (!selectedProduct) return

    try {
      setPurchaseLoading(selectedProduct.productId)

      // Определяем итоговую цену
      const finalPrice = selectedProduct.discountPrice && selectedProduct.discountPrice < selectedProduct.price
        ? selectedProduct.discountPrice
        : selectedProduct.price

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
        currency,
        `Оплата подписки: ${selectedProduct.name}`,
        selectedProduct.productId,
        network
      )

      if (!paymentResult) {
        throw new Error('Ошибка создания платежа')
      }

      console.log('✅ NOWPayment created:', paymentResult)

      // Применяем промокод, если он был использован
      if (promoCodeId) {
        try {
          // Применяем промокод к платежу
          const applyPromoResponse = await fetch('/api/promocodes/apply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(webAppData && { 'x-telegram-init-data': webAppData })
            },
            body: JSON.stringify({
              promoId: promoCodeId,
              paymentId: paymentResult.payment_id?.toString()
            })
          })

          const applyResult = await applyPromoResponse.json()
          if (applyResult.success) {
            console.log('✅ Promo code applied successfully')
          } else {
            console.error('❌ Failed to apply promo code:', applyResult.error)
          }
        } catch (promoError) {
          console.error('❌ Error applying promo code:', promoError)
        }
      }

      // Закрываем модальное окно
      setShowCurrencyModal(false)
      setSelectedProduct(null)

      // Показываем информацию об успешном создании платежа
      alert(`✅ Платеж создан!

📦 ${selectedProduct.name}
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

  // Функция для закрытия модального окна
  const handleCloseCurrencyModal = () => {
    setShowCurrencyModal(false)
    setSelectedProduct(null)
  }


  useEffect(() => {
    const initData = parseTelegramData()

    if (initData) {
      setUser(initData)
      console.log('✅ User data parsed from URL:', initData)
      console.log('🔗 Environment URL:', process.env.NEXT_PUBLIC_APP_URL)

      // Проверяем, первый ли это вход
      const hasVisitedBefore = localStorage.getItem('telegram_app_visited')

      if (!hasVisitedBefore) {
        // Первый вход - открываем поддержку
        setActiveTab('support')
        setIsFirstVisit(true)
        localStorage.setItem('telegram_app_visited', 'true')
      } else {
        // Повторный вход - открываем продукты
        setActiveTab('products')
        setIsFirstVisit(false)
      }

      // Загружаем продукты после получения данных пользователя
      loadProducts()
      // Загружаем подписки пользователя
      loadUserSubscriptions()
    } else {
      console.log('❌ No Telegram data found in URL')
      console.log('🔗 Environment URL:', process.env.NEXT_PUBLIC_APP_URL)
      // Если нет данных Telegram, открываем поддержку для помощи
      setActiveTab('support')
    }

    setIsLoading(false)
  }, [])

  // Загружаем подписки когда переключаемся на вкладку
  useEffect(() => {
    if (activeTab === 'subscriptions' && user) {
      loadUserSubscriptions()
    }
  }, [activeTab, user])

  // Улучшенный loading компонент
  if (isLoading) {
    return (
      <div className="min-h-screen tg-app flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="loading-spinner lg text-blue-600 mx-auto"></div>
            <div className="absolute inset-0 loading-spinner lg text-purple-600 mx-auto opacity-50 scale-75"></div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold tg-text-primary">Загрузка приложения...</h3>
            <p className="text-sm text-gray-500">Подготавливаем всё для вас</p>
          </div>
        </div>
      </div>
    )
  }

  // Улучшенное состояние ошибки
  if (!user) {
    return (
      <div className="min-h-screen tg-app flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.232 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-semibold tg-text-primary">Ошибка доступа</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Не удалось получить данные пользователя Telegram. Пожалуйста, откройте приложение через бота в мобильном Telegram.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary w-full"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen tg-app">
      {/* Улучшенный Header с адаптивным дизайном */}
      <header className="tg-header">
        <div className="container">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.first_name?.charAt(0) || 'U'}
              </div>
              <div>
                <h1 className="tg-heading-primary">
                  Привет, {user?.first_name || 'Пользователь'}! 👋
                </h1>
                <p className="tg-text-muted">Управляйте подписками легко</p>
              </div>
            </div>

            {/* Индикатор статуса */}
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-soft"></div>
              <span className="text-xs text-gray-500 hidden sm:inline">Online</span>
            </div>
          </div>

          {/* Улучшенные табы с адаптивным дизайном */}
          <nav className="mt-4">
            <div className="tabs-container">
              <button
                onClick={() => setActiveTab('products')}
                className={`tab-button ${activeTab === 'products' ? 'active' : ''}`}
              >
                <span className="flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span className="hidden xs:inline">Магазин</span>
                  <span className="xs:hidden">🛍️</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`tab-button ${activeTab === 'subscriptions' ? 'active' : ''}`}
              >
                <span className="flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span className="hidden xs:inline">Мои подписки</span>
                  <span className="xs:hidden">📋</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`tab-button ${activeTab === 'payments' ? 'active' : ''}`}
              >
                <span className="flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span className="hidden xs:inline">Платежи</span>
                  <span className="xs:hidden">💳</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('support')}
                className={`tab-button ${activeTab === 'support' ? 'active' : ''}`}
              >
                <span className="flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="hidden xs:inline">Поддержка</span>
                  <span className="xs:hidden">💬</span>
                </span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Debug Panel (только для разработки) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="container mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="font-semibold text-amber-800 mb-3 flex items-center space-x-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              <span>Отладка NOWPayments</span>
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium">Loading:</span>
                <span className={`ml-2 ${paymentLoading ? 'text-amber-600' : 'text-green-600'}`}>
                  {paymentLoading ? 'Yes ⏳' : 'No'}
                </span>
              </div>
              <div>
                <span className="font-medium">Error:</span>
                <span className="ml-2">{paymentError || 'None'}</span>
              </div>
              <div>
                <span className="font-medium">Payment Data:</span>
                <span className="ml-2">{paymentData ? `ID: ${paymentData.payment_id}` : 'None'}</span>
              </div>
              <div className="col-span-2">
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
                  className="mt-2 px-3 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Проверить console.log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Основной контент с улучшенной адаптивностью */}
      <main className="container py-6">
        {activeTab === 'products' && (
          <div className="space-y-6 fade-in">
            <div className="text-center space-y-2">
              <h2 className="tg-heading-primary">🛍️ Магазин подписок</h2>
              <p className="tg-text-secondary">Выберите подходящий план для доступа к эксклюзивному контенту</p>
            </div>

            {productsLoading ? (
              <div className="grid-responsive">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="skeleton-card"></div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold tg-text-primary mb-2">😕 Нет доступных подписок</h3>
                  <p className="text-gray-600 text-sm">Попробуйте обновить страницу или свяжитесь с администратором</p>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="btn btn-primary"
                >
                  Обновить страницу
                </button>
              </div>
            ) : (
              <>
                <div className="grid-responsive">
                  {products.map((product, index) => (
                    <div
                      key={product.productId}
                      className="subscription-card hover-lift slide-up"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold tg-text-primary mb-2">{product.name}</h3>
                          <p className="tg-text-secondary text-sm leading-relaxed">{product.description}</p>
                          {product.channel && (
                            <div className="flex items-center mt-3 text-xs tg-text-muted">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                              </svg>
                              {product.channel.name}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-baseline space-x-2">
                            {product.discountPrice && product.discountPrice < product.price ? (
                              <>
                                <span className="text-2xl font-bold text-transparent bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text">
                                  ${product.discountPrice.toFixed(2)}
                                </span>
                                <span className="text-sm text-gray-500 line-through">
                                  ${product.price.toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span className="text-2xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
                                ${product.price.toFixed(2)}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">/{product.periodDays}дней</span>
                          </div>
                        </div>

                        {/* Кнопки демо и покупки */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          {product.allowDemo && (
                            <button
                              onClick={() => handleDemoRequest(product)}
                              disabled={demoLoading === product.productId}
                              className={`touch-target btn transition-all duration-200 flex-1 ${
                                demoLoading === product.productId
                                  ? 'btn-secondary opacity-50 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white shadow-lg hover:shadow-xl'
                              }`}
                            >
                              {demoLoading === product.productId ? (
                                <>
                                  <div className="loading-spinner sm mr-2"></div>
                                  <span>Создание...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                  </svg>
                                  <span>Демо {product.demoDays}дн</span>
                                </>
                              )}
                            </button>
                          )}

                          <button
                            onClick={() => handlePurchase(product)}
                            disabled={purchaseLoading === product.productId || paymentLoading}
                            className={`touch-target btn transition-all duration-200 flex-1 ${
                              purchaseLoading === product.productId || paymentLoading
                                ? 'btn-secondary opacity-50 cursor-not-allowed'
                                : product.allowDemo
                                ? 'bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-lg hover:shadow-xl'
                                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl'
                            }`}
                          >
                            {purchaseLoading === product.productId ? (
                              <>
                                <div className="loading-spinner sm mr-2"></div>
                                <span>Оплата...</span>
                              </>
                            ) : paymentLoading ? (
                              <>
                                <div className="loading-spinner sm mr-2"></div>
                                <span>Создание...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                <span>{product.allowDemo ? 'Купить' : 'Купить'}</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Информация о демо-доступе */}
                        {product.allowDemo && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-start space-x-2">
                              <svg className="w-4 h-4 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="flex-1">
                                <p className="text-sm text-green-800 font-medium">Бесплатный демо-доступ</p>
                                <p className="text-xs text-green-600 mt-1">
                                  Попробуйте {product.demoDays} дней бесплатно. По окончании демо-периода доступ будет автоматически прекращен.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-center py-8 space-y-2">
                  <div className="inline-flex items-center space-x-2 text-sm text-gray-600">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Безопасная оплата через NOWPayments</span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Поддерживаем Bitcoin, Ethereum, USDT, USDC и другие криптовалюты</div>
                    <div>Мгновенная активация подписки после оплаты</div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="space-y-6 fade-in">
            <div className="text-center space-y-2">
              <h2 className="tg-heading-primary">📋 Мои подписки</h2>
              <p className="tg-text-secondary">Управляйте вашими активными подписками</p>
            </div>

            {subscriptionsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="skeleton-card"></div>
                ))}
              </div>
            ) : userSubscriptions.length === 0 ? (
              <div className="text-center py-12 space-y-6">
                <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto">
                  <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <div className="space-y-3">
                  <h3 className="text-xl font-bold tg-text-primary">У вас пока нет подписок</h3>
                  <p className="text-gray-600">Перейдите в раздел "Подписки", чтобы оформить доступ к эксклюзивному контенту</p>
                </div>
                <button
                  onClick={() => setActiveTab('products')}
                  className="btn btn-primary"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  Выбрать подписку
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {userSubscriptions.map((subscription, index) => (
                  <div
                    key={subscription.subscriptionId}
                    className="subscription-card hover-lift slide-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="text-lg font-bold tg-text-primary">
                            {subscription.product?.name || 'Подписка'}
                          </h3>
                          {subscription.product?.channel && (
                            <div className="flex items-center mt-2 text-sm text-gray-600">
                              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                              </svg>
                              {subscription.product.channel.name}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center text-gray-600">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Истекает: {new Date(subscription.expiresAt).toLocaleDateString('ru-RU')}</span>
                          </div>
                          <div className="flex items-center text-gray-600">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Осталось: {subscription.daysRemaining || Math.ceil((new Date(subscription.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} дней</span>
                          </div>
                        </div>
                      </div>

                      <div className="ml-4">
                        <span className={`status-badge ${
                          subscription.status === 'active' ? 'active' : 'expired'
                        }`}>
                          {subscription.status === 'active' ? (
                            <span className="flex items-center space-x-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span>Активна</span>
                            </span>
                          ) : (
                            <span className="flex items-center space-x-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              <span>Истекла</span>
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {subscription.status === 'active' && (
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <p className="text-sm text-gray-600">Наслаждайтесь доступом к эксклюзивному контенту!</p>
                        <button className="btn btn-primary btn-sm">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Продлить
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="fade-in">
            <PaymentTab parseTelegramInitData={parseTelegramInitData} />
          </div>
        )}

        {activeTab === 'support' && (
          <div className="fade-in">
            <SupportPage onBack={() => setActiveTab('products')} isFirstVisit={isFirstVisit} />
          </div>
        )}

        {/* Модальное окно выбора валюты и сети */}
        <CurrencyNetworkModal
          isOpen={showCurrencyModal}
          onClose={handleCloseCurrencyModal}
          onConfirm={handleConfirmPurchase}
          productName={selectedProduct?.name || ''}
          price={selectedProduct?.discountPrice && selectedProduct.discountPrice < selectedProduct.price
            ? selectedProduct.discountPrice
            : selectedProduct?.price || 0}
          loading={purchaseLoading !== null}
          productId={selectedProduct?.productId || ''}
        />
      </main>
    </div>
  )
}