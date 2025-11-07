'use client'

import { useEffect, useState } from 'react'
import AdminDashboard from '@/components/admin/AdminDashboard'

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

export default function AdminPage() {
  console.log('✅ Admin page v3.0 - full management loaded correctly')
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    totalProducts: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initData = parseTelegramData()

    if (initData) {
      setUser(initData)
      console.log('✅ Admin user data parsed from URL:', initData)

      // Загружаем статистику
      fetchStats()
    } else {
      console.log('❌ No Telegram data found in URL')
    }

    setIsLoading(false)
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
        console.log('✅ Admin stats loaded:', data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

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
        <div className="text-center max-w-md">
          <div className="text-red-600 text-2xl mb-4">🔒 Доступ запрещен</div>
          <p className="text-gray-600 mb-4">Административная панель доступна только через Telegram</p>
          <p className="text-gray-500 text-sm">Используйте команду /admin в боте для получения доступа</p>
        </div>
      </div>
    )
  }

  // Проверяем, что это администратор
  const adminTelegramId = "257394938"
  if (user.id.toString() !== adminTelegramId && user.id !== parseInt(adminTelegramId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-2xl mb-4">🔒 Доступ запрещен</div>
          <p className="text-gray-600 mb-4">У вас нет прав администратора</p>
          <p className="text-gray-500 text-sm">Ваш ID: {user.id}, ID администратора: {adminTelegramId}</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'dashboard', name: '📊 Обзор', icon: '📊' },
    { id: 'users', name: '👥 Пользователи', icon: '👥' },
    { id: 'subscriptions', name: '📋 Подписки', icon: '📋' },
    { id: 'products', name: '📦 Продукты', icon: '📦' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">👑 Панель администратора</h1>
              <p className="text-sm text-gray-600 mt-1">TMA-Подписка | Полное управление</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Привет, {user.first_name}! {user.last_name || ''}
              </div>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {user.first_name[0]?.toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon} {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Всего пользователей</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                  </div>
                  <div className="text-3xl text-blue-600">👥</div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Активные подписки</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.activeSubscriptions}</p>
                  </div>
                  <div className="text-3xl text-green-600">📋</div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Общая выручка</p>
                    <p className="text-2xl font-bold text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
                  </div>
                  <div className="text-3xl text-yellow-600">💰</div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Продуктов</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
                  </div>
                  <div className="text-3xl text-purple-600">📦</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">⚡ Быстрые действия</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('users')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
                >
                  <div className="text-2xl mb-2">👤</div>
                  <div className="font-medium text-gray-900">Добавить пользователя</div>
                  <div className="text-sm text-gray-500">Создать нового пользователя вручную</div>
                </button>
                <button
                  onClick={() => setActiveTab('subscriptions')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
                >
                  <div className="text-2xl mb-2">➕</div>
                  <div className="font-medium text-gray-900">Создать подписку</div>
                  <div className="text-sm text-gray-500">Выдать подписку пользователю</div>
                </button>
                <button
                  onClick={() => setActiveTab('products')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left"
                >
                  <div className="text-2xl mb-2">📦</div>
                  <div className="font-medium text-gray-900">Новый продукт</div>
                  <div className="text-sm text-gray-500">Создать продукт для продажи</div>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">📈 Последняя активность</h2>
              <div className="space-y-4">
                <p className="text-gray-500 text-center py-8">Здесь будет отображаться последняя активность...</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'subscriptions' && <SubscriptionManagement />}
        {activeTab === 'products' && <ProductManagement />}
      </div>
    </div>
  )
}