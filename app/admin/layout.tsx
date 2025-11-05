'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AdminAuth } from '@/components/AdminAuth'
import { AdminSidebar } from '@/components/AdminSidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Проверяем авторизацию администратора
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/auth')
        if (response.ok) {
          setIsAuthenticated(true)
        } else {
          setIsAuthenticated(false)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="loading-spinner w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Панель администратора</h1>
            <p className="text-gray-600">TMA-Подписка</p>
          </div>
          <AdminAuth onAuthSuccess={() => setIsAuthenticated(true)} />
        </div>
      </div>
    )
  }

  return (
    <div className="admin-layout flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <header className="admin-header">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">Панель администратора</h1>
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              ↩️ На сайт
            </Link>
          </div>
        </header>
        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  )
}