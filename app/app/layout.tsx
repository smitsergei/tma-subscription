'use client'

import { useEffect } from 'react'
import Script from 'next/script'

export default function TmaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    // Инициализация Telegram Web App
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp

      // Готовим приложение
      tg.ready()
      tg.expand()
      tg.enableClosingConfirmation()

      // Устанавливаем цвета в соответствии с темой Telegram
      document.body.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff')
      document.body.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000')
      document.body.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#0088cc')
      document.body.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff')

      // Устанавливаем заголовок
      tg.setHeaderColor('secondary_bg_color')

      // Показываем кнопку назад, если нужно
      tg.onEvent('backButtonClicked', () => {
        tg.close()
      })

      // Применяем тему к body
      document.body.className = 'tg-app'
    }
  }, [])

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <div className="min-h-screen tg-app">
        {children}
      </div>
    </>
  )
}