'use client'

import { useEffect, useState } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { ProductList } from './ProductList'
import { UserSubscriptions } from './UserSubscriptions'
import { LoadingSpinner } from './LoadingSpinner'

export function TmaPageContent() {
  const { user, isLoading, isInTelegram } = useTelegram()
  const [activeTab, setActiveTab] = useState<'products' | 'subscriptions'>('products')

  if (!isInTelegram) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Ошибка доступа</div>
          <p className="text-gray-600">Это приложение должно быть открыто через Telegram</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return <LoadingSpinner />
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
            className={`flex-1 py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 ${
              activeTab === 'products'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="text-lg sm:text-base">🛍️</span>
            <span className="hidden sm:inline">Подписки</span>
            <span className="sm:hidden text-xs">Магазин</span>
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`flex-1 py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 ${
              activeTab === 'subscriptions'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="text-lg sm:text-base">📋</span>
            <span className="hidden sm:inline">Мои подписки</span>
            <span className="sm:hidden text-xs">Подписки</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {activeTab === 'products' && <ProductList telegramUser={user} />}
        {activeTab === 'subscriptions' && <UserSubscriptions telegramUser={user} />}
      </div>
    </div>
  )
}