'use client'

import { useState, useEffect } from 'react'
import { createAuthenticatedRequest } from '@/utils/telegramAuth'

interface User {
  telegramId: string
  firstName: string
  username: string
  createdAt: string
  isAdmin: boolean
  subscriptions: Subscription[]
}

interface Subscription {
  subscriptionId: string
  userId: string
  productId: string
  channelId: string
  status: string
  expiresAt: string
  createdAt: string
  product: {
    productId: string
    name: string
    price: number
    periodDays: number
    channel: {
      channelId: string
      name: string
      username: string | null
    } | null
  }
  payment: any | null
}

interface DropdownMenuProps {
  user: User
  onAddSubscription: () => void
  onDelete: () => void
  onToggleAdmin: () => void
}

function DropdownMenu({ user, onAddSubscription, onDelete, onToggleAdmin }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Действия"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
            <button
              onClick={() => {
                onAddSubscription()
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Добавить подписку
            </button>
            <button
              onClick={() => {
                onToggleAdmin()
                setIsOpen(false)
              }}
              className={`w-full text-left px-4 py-2 text-sm ${
                user.isAdmin
                  ? 'text-orange-600 hover:bg-orange-50'
                  : 'text-blue-600 hover:bg-blue-50'
              } flex items-center gap-2`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              {user.isAdmin ? 'Отнять права админа' : 'Сделать администратором'}
            </button>
            <button
              onClick={() => {
                onDelete()
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Удалить пользователя
            </button>
          </div>
        </>
      )}
    </div>
  )
}

interface UserCardProps {
  user: User
  onAddSubscription: () => void
  onDelete: () => void
  onToggleAdmin: () => void
}

function UserCard({ user, onAddSubscription, onDelete, onToggleAdmin }: UserCardProps) {
  const activeSubscriptionsCount = user.subscriptions.filter(sub => sub.status === 'active').length

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-12 h-12 ${
            user.isAdmin ? 'bg-orange-600' : 'bg-blue-600'
          } rounded-full flex items-center justify-center flex-shrink-0`}>
            <span className="text-white font-semibold text-lg">
              {user.firstName?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-lg truncate">{user.firstName}</h3>
              {user.isAdmin && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                  👑 Администратор
                </span>
              )}
            </div>
            <p className="text-gray-600 text-sm">@{user.username || 'no_username'}</p>
          </div>
        </div>
        <DropdownMenu
          user={user}
          onAddSubscription={onAddSubscription}
          onDelete={onDelete}
          onToggleAdmin={onToggleAdmin}
        />
      </div>

      {/* User Info */}
      <div className="bg-gray-50 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm">
            <div className="font-medium text-gray-900">ID: {user.telegramId.toString()}</div>
            <div className="text-gray-500">Зарегистрирован: {new Date(user.createdAt).toLocaleDateString('ru-RU')}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-gray-600">{user.subscriptions.length} подписок</span>
          </div>

          {activeSubscriptionsCount > 0 && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-green-600 font-medium">{activeSubscriptionsCount} активных</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Subscriptions */}
      {user.subscriptions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-2">Последние подписки:</div>
          <div className="space-y-1">
            {user.subscriptions.slice(0, 2).map((sub) => (
              <div key={sub.subscriptionId} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{sub.product.name}</span>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                  sub.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {sub.status === 'active' ? 'Активна' : 'Неактивна'}
                </span>
              </div>
            ))}
            {user.subscriptions.length > 2 && (
              <div className="text-xs text-gray-400 text-center">
                +{user.subscriptions.length - 2} ещё
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [userType, setUserType] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({
    telegramId: '',
    firstName: '',
    username: ''
  })

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(status && { status }),
        ...(userType && { userType })
      })

      const response = await fetch(`/api/admin/users?${params}`, createAuthenticatedRequest())
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
        setTotalPages(data.pagination?.pages || 1)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [page, search, status, userType])

  // Reset to first page when search, status or userType changes
  useEffect(() => {
    if (page > 1) {
      setPage(1)
    }
  }, [search, status, userType])

  const createUser = async () => {
    try {
      const response = await fetch('/api/admin/users', createAuthenticatedRequest({
        method: 'POST',
        body: JSON.stringify(newUser)
      }))

      if (response.ok) {
        setShowCreateModal(false)
        setNewUser({ telegramId: '', firstName: '', username: '' })
        fetchUsers()
      } else {
        const error = await response.json()
        alert(`Ошибка: ${error.error || 'Failed to create user'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('Error creating user:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to create user'}`)
    }
  }

  const deleteUser = async (telegramId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя? Это также удалит все связанные подписки.')) return

    try {
      const response = await fetch(`/api/admin/users?telegramId=${telegramId}`, createAuthenticatedRequest({
        method: 'DELETE'
      }))

      if (response.ok) {
        fetchUsers()
      } else {
        const error = await response.json()
        alert(`Ошибка: ${error.error || 'Failed to delete user'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to delete user'}`)
    }
  }

  const toggleAdmin = async (telegramId: string, currentIsAdmin: boolean) => {
    const action = currentIsAdmin ? 'отнять права администратора' : 'сделать администратором'

    if (!confirm(`Вы уверены, что хотите ${action} у этого пользователя?`)) return

    try {
      const response = await fetch('/api/admin/users', createAuthenticatedRequest({
        method: 'PATCH',
        body: JSON.stringify({
          telegramId,
          isAdmin: !currentIsAdmin
        })
      }))

      if (response.ok) {
        fetchUsers()
        alert(`Права администратора успешно ${currentIsAdmin ? 'отняты' : 'предоставлены'}`)
      } else {
        const error = await response.json()
        alert(`Ошибка: ${error.error || 'Failed to update admin status'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('Error updating admin status:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to update admin status'}`)
    }
  }

  const addSubscription = async (userId: string) => {
    // This will open subscription creation modal
    // For now, we'll use a simple prompt
    const productId = prompt('Введите ID продукта:')
    const expiresAt = prompt('Введите дату истечения (ГГГГ-ММ-ДД):')

    if (!productId || !expiresAt) return

    try {
      const response = await fetch('/api/admin/subscriptions', createAuthenticatedRequest({
        method: 'POST',
        body: JSON.stringify({
          userId,
          productId,
          expiresAt,
          status: 'active'
        })
      }))

      if (response.ok) {
        fetchUsers()
        alert('Подписка успешно создана')
      } else {
        const error = await response.json()
        alert(`Ошибка: ${error.error || 'Failed to create subscription'}\nДетали: ${error.details || ''}`)
      }
    } catch (error) {
      console.error('Error creating subscription:', error)
      alert(`Ошибка сети: ${error instanceof Error ? error.message : 'Failed to create subscription'}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Загрузка пользователей...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Управление пользователями</h2>
          <p className="text-sm text-gray-600 mt-1">{users.length} {users.length === 1 ? 'пользователь' : users.length < 5 ? 'пользователя' : 'пользователей'}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 self-start"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Добавить пользователя
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Поиск по имени или username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          value={userType}
          onChange={(e) => setUserType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Все типы</option>
          <option value="admin">👑 Администраторы</option>
          <option value="user">👤 Пользователи</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Все статусы</option>
          <option value="active">Активные подписки</option>
          <option value="inactive">Без подписок</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Пользователь
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Тип
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Telegram ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Подписки
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Дата регистрации
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.telegramId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 ${
                        user.isAdmin ? 'bg-orange-600' : 'bg-blue-600'
                      } rounded-full flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white font-medium">
                          {user.firstName?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900">{user.firstName}</div>
                          {user.isAdmin && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              👑 Администратор
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">@{user.username || 'no_username'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      user.isAdmin
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.isAdmin ? '👑 Администратор' : '👤 Пользователь'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-900 font-mono">{user.telegramId.toString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">{user.subscriptions.length}</span>
                      {user.subscriptions.filter(sub => sub.status === 'active').length > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          {user.subscriptions.filter(sub => sub.status === 'active').length} активных
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DropdownMenu
                      user={user}
                      onAddSubscription={() => addSubscription(user.telegramId.toString())}
                      onDelete={() => deleteUser(user.telegramId.toString())}
                      onToggleAdmin={() => toggleAdmin(user.telegramId.toString(), user.isAdmin)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-4">
        {users.map((user) => (
          <UserCard
            key={user.telegramId}
            user={user}
            onAddSubscription={() => addSubscription(user.telegramId.toString())}
            onDelete={() => deleteUser(user.telegramId.toString())}
            onToggleAdmin={() => toggleAdmin(user.telegramId.toString(), user.isAdmin)}
          />
        ))}
      </div>

      {/* Empty State */}
      {users.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {(search || status || userType) ? 'Пользователи не найдены' : 'Нет пользователей'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {(search || status || userType)
              ? `Попробуйте изменить ${search ? 'поисковый запрос' : ''}${search && (status || userType) ? ' или ' : ''}${status ? 'фильтр статуса' : ''}${status && userType ? ' или ' : ''}${userType ? 'фильтр типа пользователя' : ''}`
              : 'Начните с добавления первого пользователя'
            }
          </p>
          <div className="mt-6">
            {(search || status || userType) && (
              <button
                onClick={() => {
                  setSearch('')
                  setStatus('')
                  setUserType('')
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors inline-flex items-center gap-2 mr-4"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Сбросить фильтры
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Добавить пользователя
            </button>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="px-4 py-2 text-sm text-gray-700">
            Страница {page} из {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Добавить пользователя</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Telegram ID *"
                value={newUser.telegramId}
                onChange={(e) => setNewUser({...newUser, telegramId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Имя"
                value={newUser.firstName}
                onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Username (без @)"
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={createUser}
                disabled={!newUser.telegramId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}