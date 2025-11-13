'use client'

import { useState, useEffect } from 'react'
import { Send, Users, Clock, CheckCircle, XCircle, AlertCircle, Plus, Eye, Edit, Trash2, BarChart3, Calendar } from 'lucide-react'
import { BroadcastTargetType, BroadcastStatus } from '@prisma/client'
import { createAuthenticatedRequest } from '@/utils/telegramAuth'
import BroadcastPreview from './BroadcastPreview'

interface Broadcast {
  broadcastId: string
  title: string
  message: string
  targetType: BroadcastTargetType
  status: BroadcastStatus
  scheduledAt?: string
  sentAt?: string
  createdAt: string
  totalRecipients: number
  sentCount: number
  failedCount: number
  creator: {
    firstName?: string
    username?: string
  }
  _count: {
    messages: number
    filters: number
  }
}

interface BroadcastFilter {
  filterType: string
  filterValue: string
}

export default function BroadcastManagement() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
  const [filters, setFilters] = useState({ status: '' })

  // Форма создания рассылки
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    targetType: BroadcastTargetType.ALL_USERS,
    scheduledAt: '',
    filters: [] as BroadcastFilter[]
  })
  const [estimatedRecipients, setEstimatedRecipients] = useState(0)

  // Загрузка рассылок
  const loadBroadcasts = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: '10',
        ...(filters.status && { status: filters.status })
      })

      const response = await fetch(`/api/admin/broadcasts?${params}`, createAuthenticatedRequest())

      if (!response.ok) throw new Error('Ошибка загрузки рассылок')

      const data = await response.json()
      setBroadcasts(data.broadcasts)
      setPagination(data.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  // Создание рассылки
  const handleCreate = async () => {
    try {
      const response = await fetch('/api/admin/broadcasts', {
        method: 'POST',
        ...createAuthenticatedRequest({
          body: JSON.stringify(formData)
        })
      })

      if (!response.ok) throw new Error('Ошибка создания рассылки')

      setShowCreateModal(false)
      setFormData({
        title: '',
        message: '',
        targetType: BroadcastTargetType.ALL_USERS,
        scheduledAt: '',
        filters: []
      })
      setEstimatedRecipients(0)
      loadBroadcasts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания')
    }
  }

  // Отправка рассылки
  const handleSend = async (broadcastId: string) => {
    if (!confirm('Вы уверены, что хотите отправить рассылку?')) return

    try {
      const response = await fetch(`/api/admin/broadcasts/${broadcastId}/send`, {
        method: 'POST',
        ...createAuthenticatedRequest()
      })

      if (!response.ok) throw new Error('Ошибка отправки рассылки')

      loadBroadcasts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки')
    }
  }

  // Удаление рассылки
  const handleDelete = async (broadcastId: string) => {
    if (!confirm('Вы уверены, что хотите удалить рассылку?')) return

    try {
      const response = await fetch(`/api/admin/broadcasts/${broadcastId}`, {
        method: 'DELETE',
        ...createAuthenticatedRequest()
      })

      if (!response.ok) throw new Error('Ошибка удаления рассылки')

      loadBroadcasts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  // Получение названия типа цели
  const getTargetTypeName = (type: BroadcastTargetType) => {
    const names: Record<BroadcastTargetType, string> = {
      [BroadcastTargetType.ALL_USERS]: 'Все пользователи',
      [BroadcastTargetType.ACTIVE_SUBSCRIPTIONS]: 'Активные подписки',
      [BroadcastTargetType.EXPIRED_SUBSCRIPTIONS]: 'Истекшие подписки',
      [BroadcastTargetType.TRIAL_USERS]: 'Триал пользователи',
      [BroadcastTargetType.PRODUCT_SPECIFIC]: 'Конкретный продукт',
      [BroadcastTargetType.CHANNEL_SPECIFIC]: 'Конкретный канал',
      [BroadcastTargetType.CUSTOM_FILTER]: 'Кастомный фильтр'
    }
    return names[type] || type
  }

  // Получение статуса и иконки
  const getStatusInfo = (status: BroadcastStatus) => {
    switch (status) {
      case BroadcastStatus.DRAFT:
        return { icon: Edit, color: 'text-gray-500 bg-gray-100', text: 'Черновик' }
      case BroadcastStatus.SCHEDULED:
        return { icon: Calendar, color: 'text-blue-500 bg-blue-100', text: 'Запланирована' }
      case BroadcastStatus.SENDING:
        return { icon: Clock, color: 'text-yellow-500 bg-yellow-100', text: 'Отправляется' }
      case BroadcastStatus.COMPLETED:
        return { icon: CheckCircle, color: 'text-green-500 bg-green-100', text: 'Завершена' }
      case BroadcastStatus.FAILED:
        return { icon: XCircle, color: 'text-red-500 bg-red-100', text: 'Ошибка' }
      case BroadcastStatus.CANCELLED:
        return { icon: AlertCircle, color: 'text-orange-500 bg-orange-100', text: 'Отменена' }
      default:
        return { icon: AlertCircle, color: 'text-gray-500 bg-gray-100', text: status }
    }
  }

  useEffect(() => {
    loadBroadcasts()
  }, [pagination.page, filters])

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">📢 Управление рассылками</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Новая рассылка
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex gap-4 mb-6">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Все статусы</option>
          <option value="DRAFT">Черновики</option>
          <option value="SCHEDULED">Запланированные</option>
          <option value="SENDING">Отправляются</option>
          <option value="COMPLETED">Завершенные</option>
          <option value="FAILED">С ошибкой</option>
        </select>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Таблица рассылок */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Рассылка
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Целевая аудитория
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статистика
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Создана
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {broadcasts.map((broadcast) => {
                const statusInfo = getStatusInfo(broadcast.status)
                const StatusIcon = statusInfo.icon

                return (
                  <tr key={broadcast.broadcastId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {broadcast.title}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {broadcast.message.substring(0, 100)}...
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {broadcast.creator.firstName || broadcast.creator.username || 'Админ'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {getTargetTypeName(broadcast.targetType)}
                      </div>
                      {broadcast._count.filters > 0 && (
                        <div className="text-xs text-gray-500">
                          {broadcast._count.filters} фильтр(ов)
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                        <StatusIcon size={14} />
                        {statusInfo.text}
                      </div>
                      {broadcast.scheduledAt && (
                        <div className="text-xs text-gray-500 mt-1">
                          Запланирована: {new Date(broadcast.scheduledAt).toLocaleString('ru-RU')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <div>Всего: {broadcast.totalRecipients}</div>
                        <div className="text-green-600">Отправлено: {broadcast.sentCount}</div>
                        <div className="text-red-600">Ошибок: {broadcast.failedCount}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(broadcast.createdAt).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {broadcast.status === BroadcastStatus.DRAFT && (
                          <button
                            onClick={() => handleSend(broadcast.broadcastId)}
                            className="text-green-600 hover:text-green-900"
                            title="Отправить"
                          >
                            <Send size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedBroadcast(broadcast)
                            setShowStatsModal(true)
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Статистика"
                        >
                          <BarChart3 size={18} />
                        </button>
                        <button
                          className="text-red-600 hover:text-red-900"
                          onClick={() => handleDelete(broadcast.broadcastId)}
                          title="Удалить"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {broadcasts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Нет рассылок
            </div>
          )}
        </div>
      )}

      {/* Пагинация */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6 gap-2">
          <button
            disabled={pagination.page === 1}
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Назад
          </button>
          <span className="px-4 py-2">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page === pagination.totalPages}
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Вперед
          </button>
        </div>
      )}

      {/* Модальное окно создания рассылки */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Новая рассылка</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название рассылки
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Например: Анонс новых функций"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Целевая аудитория
                </label>
                <select
                  value={formData.targetType}
                  onChange={(e) => setFormData({ ...formData, targetType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.values(BroadcastTargetType).map((type) => (
                    <option key={type} value={type}>
                      {getTargetTypeName(type)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Сообщение
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={6}
                  placeholder="Текст сообщения для рассылки..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Запланировать отправку (необязательно)
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Предпросмотр получателей */}
              <BroadcastPreview
                targetType={formData.targetType}
                filters={formData.filters}
                onPreviewUpdate={setEstimatedRecipients}
              />

              {/* Информация о количестве получателей */}
              {estimatedRecipients > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-green-800">
                    <strong>Ожидаемое количество получателей: {estimatedRecipients}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={!formData.title || !formData.message}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно статистики */}
      {showStatsModal && selectedBroadcast && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Статистика рассылки</h3>
            <BroadcastStats broadcast={selectedBroadcast} onClose={() => setShowStatsModal(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

// Компонент статистики
function BroadcastStats({ broadcast, onClose }: { broadcast: Broadcast; onClose: () => void }) {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch(`/api/admin/broadcasts/${broadcast.broadcastId}/stats`, createAuthenticatedRequest())

        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Ошибка загрузки статистики:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [broadcast.broadcastId])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Общая статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-blue-600 text-sm font-medium">Всего получателей</div>
          <div className="text-2xl font-bold text-blue-900">{stats?.stats.totalRecipients || 0}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-green-600 text-sm font-medium">Отправлено</div>
          <div className="text-2xl font-bold text-green-900">{stats?.stats.sentCount || 0}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-red-600 text-sm font-medium">Ошибок</div>
          <div className="text-2xl font-bold text-red-900">{stats?.stats.failedCount || 0}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="text-yellow-600 text-sm font-medium">В прогрессе</div>
          <div className="text-2xl font-bold text-yellow-900">{stats?.progressPercentage || 0}%</div>
        </div>
      </div>

      {/* Прогресс бар */}
      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Прогресс отправки</span>
          <span>{stats?.progressPercentage || 0}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${stats?.progressPercentage || 0}%` }}
          ></div>
        </div>
      </div>

      {/* Недавние ошибки */}
      {stats?.recentFailures && stats.recentFailures.length > 0 && (
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">Недавние ошибки</h4>
          <div className="space-y-2">
            {stats.recentFailures.map((failure: any, index: number) => (
              <div key={index} className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium text-red-900">
                      {failure.user?.firstName || failure.user?.username || 'User'}
                    </div>
                    <div className="text-xs text-red-700 mt-1">
                      {failure.error}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(failure.createdAt).toLocaleString('ru-RU')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Закрыть
        </button>
      </div>
    </div>
  )
}