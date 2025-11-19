'use client'

import { useEffect, useState } from 'react'
import { Subscription, DemoAccess } from '@/types'
import { formatDate, formatTimeLeft, isSubscriptionActive } from '@/lib/utils'

interface UserSubscriptionsProps {
  telegramUser?: any
}

// Функция для получения Telegram init данных из URL (как в основном приложении)
function parseTelegramInitData() {
  if (typeof window === 'undefined') return null

  const urlParams = new URLSearchParams(window.location.hash.slice(1))
  const webAppData = urlParams.get('tgWebAppData')
  return webAppData
}

export function UserSubscriptions({ telegramUser }: UserSubscriptionsProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [demoAccesses, setDemoAccesses] = useState<DemoAccess[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Получаем Telegram init данные (как в основном приложении)
        const webAppData = parseTelegramInitData()

        // Загружаем подписки
        const subscriptionsResponse = await fetch('/api/user/subscriptions' + (webAppData ? `?initData=${encodeURIComponent(webAppData)}` : ''), {
          headers: {
            'Content-Type': 'application/json',
            ...(webAppData && { 'x-telegram-init-data': webAppData })
          }
        })

        const subscriptionsData = await subscriptionsResponse.json()

        if (subscriptionsResponse.ok && subscriptionsData.success) {
          setSubscriptions(subscriptionsData.data)
        } else {
          // Пробуем debug endpoint если основной не сработал
          console.log('🔄 Trying debug endpoint for subscriptions...')
          const debugResponse = await fetch('/api/debug/test-subscription')
          const debugData = await debugResponse.json()

          if (debugData.success) {
            const activeSubscriptions = debugData.data.filter((sub: any) => sub.status === 'active')
            setSubscriptions(activeSubscriptions)
          } else {
            setError(subscriptionsData.error || 'Ошибка загрузки подписок')
            return
          }
        }

        // Загружаем демо-доступы
        try {
          const demoResponse = await fetch('/api/user/demo-accesses' + (webAppData ? `?initData=${encodeURIComponent(webAppData)}` : ''), {
            headers: {
              'Content-Type': 'application/json',
              ...(webAppData && { 'x-telegram-init-data': webAppData })
            }
          })

          const demoData = await demoResponse.json()

          if (demoResponse.ok && demoData.success) {
            setDemoAccesses(demoData.data)
          } else {
            // Пробуем debug endpoint если основной не сработал
            console.log('🔄 Trying debug endpoint for demo accesses...')
            const debugDemoResponse = await fetch('/api/debug/test-demo')
            const debugDemoData = await debugDemoResponse.json()

            if (debugDemoResponse.ok && debugDemoData.success) {
              setDemoAccesses(debugDemoData.data)
            } else {
              console.warn('Ошибка загрузки демо-доступов:', demoData.error)
            }
          }
        } catch (demoError) {
          console.warn('Ошибка при загрузке демо-доступов:', demoError)
          // Пробуем debug endpoint при ошибке
          try {
            console.log('🔄 Trying debug endpoint for demo accesses after error...')
            const debugDemoResponse = await fetch('/api/debug/test-demo')
            const debugDemoData = await debugDemoResponse.json()

            if (debugDemoResponse.ok && debugDemoData.success) {
              setDemoAccesses(debugDemoData.data)
            }
          } catch (debugError) {
            console.warn('Debug endpoint тоже не сработал:', debugError)
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Ошибка загрузки данных')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

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

  if (subscriptions.length === 0 && demoAccesses.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-4 text-4xl">📋</div>
        <p className="text-gray-600 mb-4">У вас пока нет активных подписок и демо-доступов</p>
        <button
          onClick={() => {
            // Переключение на вкладку с продуктами
            const productsTab = document.querySelector('[data-tab="products"]') as HTMLButtonElement
            productsTab?.click()
          }}
          className="text-blue-600 underline"
        >
          Посмотреть доступные подписки
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Демо-доступы */}
      {demoAccesses.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold tg-heading-primary text-lg mb-3">🎯 Демо-доступы</h3>
          {demoAccesses.map((demo) => {
            const isActive = demo.isActive && new Date(demo.expiresAt) > new Date()
            const isExpiringSoon = isActive &&
              new Date(demo.expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 // 3 дня

            return (
              <div
                key={demo.id}
                className={`subscription-card ${isActive ? 'active' : 'expired'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold tg-heading-primary">
                        {demo.product?.name || 'Демо-доступ'}
                      </h3>
                      <span className="text-xs bg-purple-100 text-purple-900 px-2 py-1 rounded-full">
                        ДЕМО
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`status-badge ${isActive ? 'active' : 'expired'}`}>
                        {isActive ? 'Активен' : 'Истёк'}
                      </span>
                      {isExpiringSoon && (
                        <span className="text-xs text-orange-600 font-medium">
                          ⚠️ Скоро истекает
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between tg-text-secondary">
                    <span>Начало:</span>
                    <span>{formatDate(demo.startedAt)}</span>
                  </div>
                  <div className="flex justify-between tg-text-secondary">
                    <span>Окончание:</span>
                    <span>{formatDate(demo.expiresAt)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="tg-text-primary">Осталось:</span>
                    <span className={isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {formatTimeLeft(demo.expiresAt)}
                    </span>
                  </div>
                </div>

                {!isActive && demo.product && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => {
                        // Переключение на вкладку с продуктами для покупки
                        const productsTab = document.querySelector('[data-tab="products"]') as HTMLButtonElement
                        productsTab?.click()
                      }}
                      className="tg-button text-sm px-4 py-2"
                    >
                      Приобрести подписку
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Платные подписки */}
      {subscriptions.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold tg-heading-primary text-lg mb-3">💳 Подписки</h3>
          {subscriptions.map((subscription) => {
            const isActive = isSubscriptionActive(subscription.expiresAt)
            const isExpiringSoon = isActive &&
              new Date(subscription.expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 // 3 дня

            return (
              <div
                key={subscription.subscriptionId}
                className={`subscription-card ${isActive ? 'active' : 'expired'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold tg-heading-primary mb-1">
                      {subscription.product?.name || 'Подписка'}
                    </h3>
                    {subscription.channel && (
                      <p className="text-sm tg-text-primary mb-2">
                        📢 {subscription.channel.name}
                      </p>
                    )}
                    <div className="flex items-center space-x-2">
                      <span className={`status-badge ${subscription.status}`}>
                        {subscription.status === 'active' ? 'Активна' :
                         subscription.status === 'expired' ? 'Истекла' : 'Отменена'}
                      </span>
                      {isExpiringSoon && (
                        <span className="text-xs text-orange-600 font-medium">
                          ⚠️ Скоро истекает
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between tg-text-secondary">
                    <span>Начало:</span>
                    <span>{formatDate(subscription.startsAt)}</span>
                  </div>
                  <div className="flex justify-between tg-text-secondary">
                    <span>Окончание:</span>
                    <span>{formatDate(subscription.expiresAt)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="tg-text-primary">Осталось:</span>
                    <span className={isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {formatTimeLeft(subscription.expiresAt)}
                    </span>
                  </div>
                </div>

                {isActive && subscription.channel && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <a
                      href={`https://t.me/${subscription.channel.username?.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      🔗 Перейти к каналу
                    </a>
                  </div>
                )}

                {!isActive && subscription.product && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => {
                        // Здесь можно добавить логику продления подписки
                        alert('Функция продления подписки в разработке')
                      }}
                      className="tg-button text-sm px-4 py-2"
                    >
                      Продлить подписку
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}