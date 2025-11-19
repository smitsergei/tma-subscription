'use client'

import { useEffect, useState } from 'react'
import { Subscription, DemoAccess } from '@/types'
import { apiRequest, formatDate, formatTimeLeft, isSubscriptionActive } from '@/lib/utils'

interface UserSubscriptionsProps {
  telegramUser?: any
}

export function UserSubscriptions({ telegramUser }: UserSubscriptionsProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [demoAccesses, setDemoAccesses] = useState<DemoAccess[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Загружаем подписки
        const subscriptionsResult = await apiRequest<Subscription[]>('/api/user/subscriptions')
        if (subscriptionsResult.success && subscriptionsResult.data) {
          setSubscriptions(subscriptionsResult.data)
        } else {
          setError(subscriptionsResult.error || 'Ошибка загрузки подписок')
          return
        }

        // Загружаем демо-доступы
        const demoResult = await apiRequest<DemoAccess[]>('/api/user/demo-accesses')
        if (demoResult.success && demoResult.data) {
          setDemoAccesses(demoResult.data)
        } else {
          // Не считаем ошибкой отсутствие демо-доступов
          console.warn('Ошибка загрузки демо-доступов:', demoResult.error)
        }
      } catch (err) {
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
          <h3 className="font-semibold text-gray-900 text-lg mb-3">🎯 Демо-доступы</h3>
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
                      <h3 className="font-semibold text-gray-900">
                        {demo.product?.name || 'Демо-доступ'}
                      </h3>
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
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
                  <div className="flex justify-between text-gray-600">
                    <span>Начало:</span>
                    <span>{formatDate(demo.startedAt)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Окончание:</span>
                    <span>{formatDate(demo.expiresAt)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Осталось:</span>
                    <span className={isActive ? 'text-green-600' : 'text-red-600'}>
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
          <h3 className="font-semibold text-gray-900 text-lg mb-3">💳 Подписки</h3>
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
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {subscription.product?.name || 'Подписка'}
                    </h3>
                    {subscription.channel && (
                      <p className="text-sm text-gray-600 mb-2">
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
                  <div className="flex justify-between text-gray-600">
                    <span>Начало:</span>
                    <span>{formatDate(subscription.startsAt)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Окончание:</span>
                    <span>{formatDate(subscription.expiresAt)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Осталось:</span>
                    <span className={isActive ? 'text-green-600' : 'text-red-600'}>
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