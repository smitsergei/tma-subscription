'use client'

import { useEffect, useState } from 'react'
import { StatsCard } from '@/components/admin/StatsCard'
import { RecentSubscriptions } from '@/components/admin/RecentSubscriptions'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    totalProducts: 0
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/stats')
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Панель управления</h2>
        <p className="text-gray-600 mt-1">Обзор состояния системы</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Всего пользователей"
          value={stats.totalUsers}
          icon="👥"
          color="blue"
        />
        <StatsCard
          title="Активные подписки"
          value={stats.activeSubscriptions}
          icon="✅"
          color="green"
        />
        <StatsCard
          title="Общая выручка"
          value={`$${stats.totalRevenue}`}
          icon="💰"
          color="yellow"
        />
        <StatsCard
          title="Всего продуктов"
          value={stats.totalProducts}
          icon="📦"
          color="purple"
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Последние подписки</h3>
        <RecentSubscriptions />
      </div>
    </div>
  )
}