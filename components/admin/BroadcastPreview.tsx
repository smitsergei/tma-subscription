'use client'

import { useState, useEffect } from 'react'
import { Eye, Users, AlertCircle } from 'lucide-react'
import { BroadcastTargetType } from '@prisma/client'

interface BroadcastFilter {
  filterType: string
  filterValue: string
}

interface PreviewRecipient {
  telegramId: string
  firstName?: string
  username?: string
  createdAt: string
  subscriptionStatus: string
  productName: string
  channelName: string
  hasDemoAccess: boolean
}

interface BroadcastPreviewProps {
  targetType: BroadcastTargetType
  filters: BroadcastFilter[]
  onPreviewUpdate?: (totalCount: number) => void
}

export default function BroadcastPreview({ targetType, filters, onPreviewUpdate }: BroadcastPreviewProps) {
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<{
    totalCount: number
    previewCount: number
    recipients: PreviewRecipient[]
  } | null>(null)
  const [error, setError] = useState('')

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

  const loadPreview = async () => {
    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('adminToken')

      const response = await fetch('/api/admin/broadcasts/preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetType,
          filters,
          limit: 50
        })
      })

      if (!response.ok) {
        throw new Error('Ошибка загрузки предпросмотра')
      }

      const data = await response.json()
      setPreviewData(data)

      if (onPreviewUpdate) {
        onPreviewUpdate(data.totalCount)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (showPreview) {
      loadPreview()
    }
  }, [targetType, filters, showPreview])

  return (
    <div className="space-y-4">
      {/* Информация о целевой аудитории */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-800">
          <Users size={20} />
          <span className="font-medium">Целевая аудитория:</span>
          <span>{getTargetTypeName(targetType)}</span>
        </div>

        {filters.length > 0 && (
          <div className="mt-2 text-sm text-blue-700">
            Применено фильтров: {filters.length}
          </div>
        )}
      </div>

      {/* Кнопка предпросмотра */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
      >
        <Eye size={18} />
        {showPreview ? 'Скрыть' : 'Показать'} получателей
      </button>

      {/* Ошибка */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Предпросмотр получателей */}
      {showPreview && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : previewData ? (
            <>
              {/* Статистика */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-gray-600 text-sm">Всего получателей</div>
                  <div className="text-2xl font-bold text-gray-900">{previewData.totalCount}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-gray-600 text-sm">Показано в предпросмотре</div>
                  <div className="text-2xl font-bold text-gray-900">{previewData.previewCount}</div>
                </div>
              </div>

              {/* Таблица получателей */}
              {previewData.recipients.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Пользователь
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Подписка
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Продукт
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Канал
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Демо
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {previewData.recipients.map((recipient, index) => (
                          <tr key={`${recipient.telegramId}-${index}`} className="hover:bg-gray-50">
                            <td className="px-4 py-2">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {recipient.firstName || 'Нет имени'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  @{recipient.username || recipient.telegramId}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-sm text-gray-900">
                                {recipient.subscriptionStatus}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-sm text-gray-900">
                                {recipient.productName}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="text-sm text-gray-900">
                                {recipient.channelName}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              {recipient.hasDemoAccess ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Да
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Нет
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Нет получателей для отображения
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Нажмите "Показать получателей" для загрузки данных
            </div>
          )}
        </div>
      )}
    </div>
  )
}