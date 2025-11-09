'use client'

import { useEffect, useState } from 'react'
import { useTonConnectSimple } from '@/hooks/useTonConnectSimple'
import { TonConnectButton } from '@/components/TonConnectButton'

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
  const [user, setUser] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [userSubscriptions, setUserSubscriptions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'products' | 'subscriptions'>('products')
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null)

  // TON Connect integration
  const {
    isConnected,
    address,
    connectWallet,
    sendTransaction,
    isLoading: tonLoading,
    error: tonError
  } = useTonConnectSimple()

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

      // Проверяем подключен ли кошелек
      if (!isConnected) {
        console.log('🔗 Wallet not connected, connecting...')
        try {
          await connectWallet()
          console.log('✅ Wallet connected successfully')
        } catch (connectError) {
          console.error('❌ Failed to connect wallet:', connectError)
          throw new Error('Не удалось подключить кошелек. Попробуйте снова.')
        }
        return
      }

      // Получаем Telegram init данные
      const webAppData = parseTelegramInitData()
      if (!webAppData) {
        alert('❌ Ошибка: не удалось получить данные Telegram')
        return
      }

      console.log('🔄 Initiating payment...')

      // Инициализация платежа
      const initiateResponse = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': webAppData
        },
        body: JSON.stringify({
          productId: product.productId
        })
      })

      const initiateData = await initiateResponse.json()

      if (!initiateData.success) {
        throw new Error(initiateData.error || 'Ошибка инициализации платежа')
      }

      console.log('✅ Payment initiated:', initiateData.data)

      const { paymentId, transaction } = initiateData.data

      // Показываем информацию о платеже
      const confirmMessage = `Подтвердите покупку:

📦 ${product.name}
💰 Сумма: ${initiateData.data.amount} USDT
📝 Код платежа: ${initiateData.data.memo}

Подтвердите транзакцию в вашем кошельке TON`

      if (!confirm(confirmMessage)) {
        return
      }

      console.log('💳 Sending transaction...')

      // Отправка транзакции через TON Connect
      const txResult = await sendTransaction(transaction)

      if (!txResult) {
        throw new Error('Ошибка отправки транзакции')
      }

      console.log('✅ Transaction sent:', txResult)

      // Показываем статус ожидания
      alert(`✅ Транзакция отправлена!

Ожидайте подтверждения платежа.
Это может занять 1-3 минуты.

📝 Код платежа: ${initiateData.data.memo}`)

      // Начинаем проверку статуса платежа
      await verifyPaymentWithPolling(paymentId, webAppData, product)

    } catch (error) {
      console.error('❌ Purchase error:', error)
      alert(`❌ Ошибка при оформлении подписки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setPurchaseLoading(null)
    }
  }

  // Функция для проверки платежа с поллингом
  const verifyPaymentWithPolling = async (
    paymentId: string,
    initData: string,
    product: any
  ) => {
    const maxAttempts = 30 // Проверяем 5 минут (30 попыток по 10 секунд)
    let attempts = 0

    const poll = async () => {
      try {
        console.log(`🔍 Checking payment status... Attempt ${attempts + 1}`)

        const response = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': initData
          },
          body: JSON.stringify({
            txHash: 'polling', // Используем специальный маркер для поллинга
            paymentId
          })
        })

        const data = await response.json()

        if (data.success) {
          // Платеж подтвержден!
          console.log('✅ Payment confirmed!', data.data)

          alert(`🎉 Оплата прошла успешно!

📦 Подписка: ${product.name}
📢 Канал: ${data.data.channelName}
⏰ Действует до: ${new Date(data.data.expiresAt).toLocaleDateString('ru-RU')}

Спасибо за покупку!`)

          // Обновляем список подписок
          if (activeTab === 'subscriptions') {
            await loadUserSubscriptions()
          }

          return true
        } else {
          console.log('⏳ Payment not confirmed yet:', data.error)

          attempts++
          if (attempts < maxAttempts) {
            setTimeout(poll, 10000) // Проверяем каждые 10 секунд
          } else {
            // Превышено время ожидания
            alert(`⏰ Время ожидания платежа истекло

Если вы оплатили, но подписка не активировалась:
1. Проверьте, что транзакция прошла успешно
2. Обновите страницу и проверьте вкладку "Мои подписки"
3. Если проблема осталась, свяжитесь с поддержкой

📝 Код платежа: ${paymentId}`)
          }
        }
      } catch (error) {
        console.error('❌ Error polling payment:', error)
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000)
        }
      }
    }

    // Начинаем поллинг
    poll()
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
        </div>

        {/* TON Connect Status */}
        <TonConnectButton
          isConnected={isConnected}
          isLoading={tonLoading}
          error={tonError}
          address={address}
          onConnect={() => {
            console.log('🔗 TonConnectButton: Connect requested')
            connectWallet().catch(err => {
              console.error('Connect wallet error:', err)
            })
          }}
          onDisconnect={() => {
            console.log('🔌 TonConnectButton: Disconnect requested')
            // Можно добавить отключение, если нужно
          }}
        />
      </div>

      {/* Debug Panel (только для разработки) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="px-4 py-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <h4 className="font-medium text-yellow-800 mb-2">🔧 Отладка TON Connect:</h4>
            <div className="space-y-1 text-xs">
              <div>Status: {isConnected ? 'Connected ✅' : 'Not Connected ❌'}</div>
              <div>Address: {address || 'None'}</div>
              <div>Loading: {tonLoading ? 'Yes ⏳' : 'No'}</div>
              <div>Error: {tonError || 'None'}</div>
              <button
                onClick={() => {
                  console.log('🔧 Debug: window.tonConnectDebug')
                  console.log('Available window object:', Object.keys(window))
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
                        disabled={!isConnected || purchaseLoading === product.productId || tonLoading}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          purchaseLoading === product.productId || tonLoading
                            ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                            : isConnected
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                        }`}
                      >
                        {purchaseLoading === product.productId
                          ? '⏳ Оплата...'
                          : tonLoading
                            ? '🔄 Подключение...'
                            : !isConnected
                              ? '🔗 Подключите кошелек'
                              : '🛒 Купить'
                        }
                      </button>
                    </div>
                  </div>
                ))}
                <div className="text-center text-gray-500 text-sm mt-4 space-y-1">
                  <div>💳 Оплата через TON Connect (USDT)</div>
                  <div className="text-xs text-gray-400">
                    {!isConnected
                      ? '🔗 Подключите кошелек для покупки подписок'
                      : '✨ Готовы к покупке! Нажмите "Купить" для оформления подписки'
                    }
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
      </div>
    </div>
  )
}