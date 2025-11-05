'use client'

import { useEffect, useState } from 'react'
import { Subscription } from '@/types'
import { apiRequest, formatDate } from '@/lib/utils'

export function RecentSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const result = await apiRequest<Subscription[]>('/api/admin/subscriptions/recent')
        if (result.success && result.data) {
          setSubscriptions(result.data)
        }
      } catch (error) {
        console.error('Failed to fetch recent subscriptions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSubscriptions()
  }, [])

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="loading-spinner w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Подписок пока нет</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Пользователь
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Продукт
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Статус
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Создана
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Истекает
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {subscriptions.map((subscription) => (
            <tr key={subscription.subscriptionId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">
                      {subscription.user?.firstName?.[0] || 'U'}
                    </span>
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">
                      {subscription.user?.firstName || 'Unknown'} {subscription.user?.username && `(@${subscription.user.username})`}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {subscription.user?.telegramId.toString()}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{subscription.product?.name}</div>
                <div className="text-xs text-gray-500">{subscription.channel?.name}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`status-badge ${subscription.status}`}>
                  {subscription.status === 'active' ? 'Активна' :
                   subscription.status === 'expired' ? 'Истекла' : 'Отменена'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(subscription.createdAt)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(subscription.expiresAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}