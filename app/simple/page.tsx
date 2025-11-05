'use client'

import { useState, useEffect } from 'react'

export default function SimplePage() {
  const [userInfo, setUserInfo] = useState<string>('Загрузка...')

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        // Проверяем URL на наличие данных Telegram
        if (window.location.hash.includes('tgWebAppData')) {
          const urlParams = new URLSearchParams(window.location.hash.slice(1))
          const webAppData = urlParams.get('tgWebAppData')

          if (webAppData) {
            const params = new URLSearchParams(webAppData)
            const userStr = params.get('user')

            if (userStr) {
              const user = JSON.parse(decodeURIComponent(userStr))
              setUserInfo(`✅ Пользователь: ${user.first_name} ${user.last_name || ''} (@${user.username || 'no_username'})`)
            } else {
              setUserInfo('❌ Данные пользователя не найдены')
            }
          } else {
            setUserInfo('❌ tgWebAppData не найден')
          }
        } else {
          setUserInfo('❌ Нет данных Telegram в URL')
        }
      }
    } catch (error) {
      setUserInfo(`❌ Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🚀 Простая страница</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f5f5f5', borderRadius: '5px' }}>
        <h2>Статус пользователя:</h2>
        <p>{userInfo}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>URL информация:</h2>
        <p style={{ wordBreak: 'break-all', fontSize: '12px', background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
          {typeof window !== 'undefined' ? window.location.href : 'Server-side'}
        </p>
      </div>

      <div>
        <h2>API тест:</h2>
        <button
          onClick={async () => {
            try {
              const response = await fetch('/api/products')
              const data = await response.json()
              alert(`API работает! Найдено продуктов: ${data.data?.length || 0}`)
            } catch (error) {
              alert(`Ошибка API: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
          }}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🧪 Тестировать API
        </button>
      </div>
    </div>
  )
}