'use client'

import { useEffect, useState } from 'react'

export default function TestPage() {
  const [telegramInfo, setTelegramInfo] = useState<string>('Checking...')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        if (window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp
          setTelegramInfo(`✅ Telegram WebApp detected!
User: ${JSON.stringify(tg.initDataUnsafe.user || 'No user data')}`)
          tg.ready()
          tg.expand()
        } else {
          setTelegramInfo('❌ Telegram WebApp not found')
        }
      } else {
        setTelegramInfo('⏳ Window not ready yet...')
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔧 Debug Page</h1>

      <div style={{ marginBottom: '20px' }}>
        <h2>Environment Info:</h2>
        <p>User Agent: {typeof window !== 'undefined' ? window.navigator.userAgent : 'Server-side'}</p>
        <p>URL: {typeof window !== 'undefined' ? window.location.href : 'Server-side'}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Telegram Status:</h2>
        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '5px', whiteSpace: 'pre-wrap' }}>
          {telegramInfo}
        </pre>
      </div>

      {error && (
        <div style={{ marginBottom: '20px', color: 'red' }}>
          <h2>Error:</h2>
          <pre>{error}</pre>
        </div>
      )}

      <div>
        <h2>Manual Tests:</h2>
        <button
          onClick={() => {
            if (window.Telegram?.WebApp?.showAlert) {
              window.Telegram.WebApp.showAlert('Test alert!')
            } else {
              alert('Test alert (fallback)')
            }
          }}
          style={{
            padding: '10px 20px',
            margin: '5px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Test Alert
        </button>

        <button
          onClick={() => {
            if (window.Telegram?.WebApp) {
              window.Telegram.WebApp.close()
            } else {
              console.log('Cannot close - not in Telegram')
            }
          }}
          style={{
            padding: '10px 20px',
            margin: '5px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Close App
        </button>
      </div>
    </div>
  )
}