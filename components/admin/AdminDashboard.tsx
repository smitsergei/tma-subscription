'use client'

import { useState } from 'react'
import { telegramUtils } from '@/components/ui/TelegramMiniAppWrapper'
import ProductManagement from './ProductManagement'
import UserManagement from './UserManagement'
import SubscriptionManagement from './SubscriptionManagement'
import DiscountManagement from './DiscountManagement'
import PromoCodeManagement from './PromoCodeManagement'
import DemoManagement from './DemoManagement'
import PaymentManagementMobile from './PaymentManagementMobile'
import BroadcastManagement from './BroadcastManagement'

type TabType = 'users' | 'subscriptions' | 'products' | 'payments' | 'discounts' | 'promocodes' | 'demo' | 'broadcasts'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('products')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const tabs = [
    { id: 'users' as TabType, label: 'Пользователи', icon: '👥', mobileIcon: 'users' },
    { id: 'subscriptions' as TabType, label: 'Подписки', icon: '📋', mobileIcon: 'subscriptions' },
    { id: 'products' as TabType, label: 'Продукты', icon: '📦', mobileIcon: 'products' },
    { id: 'payments' as TabType, label: 'Платежи', icon: '💳', mobileIcon: 'payments' },
    { id: 'discounts' as TabType, label: 'Скидки', icon: '💰', mobileIcon: 'discount' },
    { id: 'promocodes' as TabType, label: 'Промокоды', icon: '🎫', mobileIcon: 'promos' },
    { id: 'demo' as TabType, label: 'Демо', icon: '🎓', mobileIcon: 'demo' },
    { id: 'broadcasts' as TabType, label: 'Рассылки', icon: '📢', mobileIcon: 'broadcast' }
  ]

  const renderTab = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />
      case 'subscriptions':
        return <SubscriptionManagement />
      case 'products':
        return <ProductManagement />
      case 'payments':
        // Используем мобильную версию для платежей на всех устройствах для лучшего UX
        return <PaymentManagementMobile />
      case 'discounts':
        return <DiscountManagement />
      case 'promocodes':
        return <PromoCodeManagement />
      case 'demo':
        return <DemoManagement />
      case 'broadcasts':
        return <BroadcastManagement />
      default:
        return <ProductManagement />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">🛠️ Админ-панель</h1>
            <button
              onClick={() => {
                telegramUtils.triggerHaptic('impact', 'light')
                setIsMobileMenuOpen(!isMobileMenuOpen)
              }}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="border-t border-gray-200 bg-white">
            <nav className="px-2 py-3 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    telegramUtils.triggerHaptic('selection')
                    setActiveTab(tab.id)
                    setIsMobileMenuOpen(false)
                  }}
                  className={`${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-transparent'
                  } w-full flex items-center px-3 py-2 text-sm font-medium rounded-md border transition-all duration-200`}
                >
                  <span className="mr-3 text-lg">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>

      <div className="flex">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex flex-col w-64">
            <div className="flex flex-col flex-grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto">
              {/* Desktop Header */}
              <div className="flex items-center flex-shrink-0 px-4 mb-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">T</span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <h1 className="text-lg font-semibold text-gray-900">TMA Подписка</h1>
                    <p className="text-xs text-gray-500">Панель управления</p>
                  </div>
                </div>
              </div>

              {/* Desktop Navigation */}
              <nav className="flex-1 px-2 space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      telegramUtils.triggerHaptic('selection')
                      setActiveTab(tab.id)
                    }}
                    className={`${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-l-4 border-blue-500'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                    } group w-full flex items-center px-3 py-3 text-sm font-medium rounded-r-lg transition-all duration-200`}
                  >
                    <span className="mr-3 text-xl group-hover:scale-110 transition-transform">{tab.icon}</span>
                    <span className="flex-1 text-left">{tab.label}</span>
                    {activeTab === tab.id && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col flex-1 min-h-screen">
          {/* Desktop Header - скрыт для платежей, так как мобильная версия имеет свой хедер */}
          {activeTab !== 'payments' && (
            <div className="hidden lg:block bg-white border-b border-gray-200">
              <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Управление {tabs.find(t => t.id === activeTab)?.label.toLowerCase()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-sm text-gray-500">
                      {new Date().toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content */}
          <main className="flex-1">
            <div className={`${activeTab === 'payments' ? '' : 'max-w-7xl mx-auto p-4 lg:p-6'}`}>
              {activeTab !== 'payments' && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  <div className="p-6">
                    {renderTab()}
                  </div>
                </div>
              )}
              {activeTab === 'payments' && renderTab()}
            </div>
          </main>

          {/* Bottom Mobile Navigation */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
            <div className="grid grid-cols-5 gap-1">
              {tabs.slice(0, 5).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    telegramUtils.triggerHaptic('selection')
                    setActiveTab(tab.id)
                  }}
                  className={`${
                    activeTab === tab.id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-400 hover:text-gray-600'
                  } flex flex-col items-center justify-center py-2 px-1 transition-colors duration-200`}
                >
                  <span className="text-xl mb-1">{tab.icon}</span>
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}