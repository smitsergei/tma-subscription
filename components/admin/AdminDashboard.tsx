'use client'

import { useState } from 'react'
import ProductManagement from './ProductManagement'
import UserManagement from './UserManagement'
import DiscountManagement from './DiscountManagement'
import PromoCodeManagement from './PromoCodeManagement'
import DemoManagement from './DemoManagement'

type TabType = 'users' | 'products' | 'discounts' | 'promocodes' | 'demo'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('products')

  const tabs = [
    { id: 'users' as TabType, label: '👥 Пользователи', icon: 'users' },
    { id: 'products' as TabType, label: '📦 Продукты', icon: 'products' },
    { id: 'discounts' as TabType, label: '💰 Скидки', icon: 'discount' },
    { id: 'promocodes' as TabType, label: '🎫 Промокоды', icon: 'promos' },
    { id: 'demo' as TabType, label: '🎓 Демо-доступ', icon: 'demo' }
  ]

  const renderTab = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />
      case 'products':
        return <ProductManagement />
      case 'discounts':
        return <DiscountManagement />
      case 'promocodes':
        return <PromoCodeManagement />
      case 'demo':
        return <DemoManagement />
      default:
        return <ProductManagement />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              🛠️ Панель администратора
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Управление пользователями, продуктами, скидками, промокодами и демо-доступом
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200`}
                >
                  <span className="mr-2">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm">
          {renderTab()}
        </div>

        {/* Footer Stats */}
        <div className="mt-8 bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4">
            <div className="flex flex-wrap justify-between items-center">
              <div className="text-sm text-gray-500">
                Панель администратора • TMA-Подписка
              </div>
              <div className="text-sm text-gray-500">
                Последнее обновление: {new Date().toLocaleString('ru-RU')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}