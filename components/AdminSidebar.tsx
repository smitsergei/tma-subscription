'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AdminSidebar() {
  const pathname = usePathname()

  const menuItems = [
    {
      href: '/admin',
      icon: '📊',
      label: 'Панель управления'
    },
    {
      href: '/admin/products',
      icon: '📦',
      label: 'Продукты'
    },
    {
      href: '/admin/channels',
      icon: '📢',
      label: 'Каналы'
    },
    {
      href: '/admin/users',
      icon: '👥',
      label: 'Пользователи'
    },
    {
      href: '/admin/subscriptions',
      icon: '📋',
      label: 'Подписки'
    },
    {
      href: '/admin/payments',
      icon: '💳',
      label: 'Платежи'
    },
    {
      href: '/admin/settings',
      icon: '⚙️',
      label: 'Настройки'
    }
  ]

  return (
    <div className="admin-sidebar">
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">TMA</span>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Подписка</h2>
            <p className="text-xs text-gray-500">Админ-панель</p>
          </div>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200">
        <Link
          href="/"
          className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-200"
        >
          <span className="text-lg">🏠</span>
          <span>На сайт</span>
        </Link>
      </div>
    </div>
  )
}