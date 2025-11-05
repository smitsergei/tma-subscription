'use client'

import { useEffect, useState } from 'react'

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

export default function SimpleAdminPage() {
  console.log('✅ Admin page v2.0 - loaded correctly')
  const [user, setUser] = useState<any>(null)
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">👑 Панель администратора</h1>
              <p className="text-sm text-gray-600 mt-1">TMA-Подписка | Управление</p>
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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

        {/* Recent Subscriptions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Последние подписки</h2>
          <div className="space-y-4">
            <p className="text-gray-500 text-center py-8">Загрузка подписок...</p>
          </div>
        </div>
      </div>
    </div>
  )
}