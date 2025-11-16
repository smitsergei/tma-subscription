'use client'

import { useEffect, useState } from 'react'

interface TelegramMiniAppWrapperProps {
  children: React.ReactNode
  className?: string
}

export default function TelegramMiniAppWrapper({ children, className = '' }: TelegramMiniAppWrapperProps) {
  const [isTelegram, setIsTelegram] = useState(false)
  const [theme, setTheme] = useState({
    bg_color: '#ffffff',
    text_color: '#000000',
    hint_color: '#999999',
    button_color: '#007AFF',
    button_text_color: '#ffffff'
  })

  useEffect(() => {
    // Проверяем, запущено ли приложение в Telegram
    const checkTelegram = () => {
      if (typeof window !== 'undefined') {
        const webApp = (window as any).Telegram?.WebApp
        if (webApp) {
          setIsTelegram(true)

          // Применяем Telegram стили
          webApp.ready()

          // Получаем тему Telegram
          const colorScheme = webApp.colorScheme || 'light'
          const themeParams = webApp.themeParams || {}

          setTheme({
            bg_color: themeParams.bg_color || '#ffffff',
            text_color: themeParams.text_color || '#000000',
            hint_color: themeParams.hint_color || '#999999',
            button_color: themeParams.button_color || '#007AFF',
            button_text_color: themeParams.button_text_color || '#ffffff'
          })

          // Устанавливаем цвет статус бара
          if (webApp.setHeaderColor) {
            webApp.setHeaderColor(themeParams.bg_color || '#ffffff')
          }

          // Включаем свайп назад если поддерживается
          if (webApp.enableClosingConfirmation) {
            webApp.enableClosingConfirmation()
          }

          // Устанавливаем safe area insets для iPhone
          if (webApp.viewportStableHeight) {
            const safeAreaTop = webApp.safeAreaInset?.top || 0
            document.documentElement.style.setProperty('--tg-safe-area-inset-top', `${safeAreaTop}px`)
          }
        }
      }
    }

    checkTelegram()

    // Следим за изменением темы
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      const webApp = (window as any).Telegram.WebApp
      const handleThemeChanged = () => {
        const themeParams = webApp.themeParams || {}
        setTheme({
          bg_color: themeParams.bg_color || '#ffffff',
          text_color: themeParams.text_color || '#000000',
          hint_color: themeParams.hint_color || '#999999',
          button_color: themeParams.button_color || '#007AFF',
          button_text_color: themeParams.button_text_color || '#ffffff'
        })
      }

      webApp.onEvent('themeChanged', handleThemeChanged)

      return () => {
        webApp.offEvent('themeChanged', handleThemeChanged)
      }
    }
  }, [])

  // Применяем Telegram стили к CSS переменным
  useEffect(() => {
    if (isTelegram) {
      const root = document.documentElement
      root.style.setProperty('--tg-bg-color', theme.bg_color)
      root.style.setProperty('--tg-text-color', theme.text_color)
      root.style.setProperty('--tg-hint-color', theme.hint_color)
      root.style.setProperty('--tg-button-color', theme.button_color)
      root.style.setProperty('--tg-button-text-color', theme.button_text_color)
    }
  }, [isTelegram, theme])

  // Haptic feedback функция
  const triggerHaptic = (type: 'impact' | 'notification' | 'selection', style?: any) => {
    if (isTelegram && (window as any).Telegram?.WebApp?.HapticFeedback) {
      const haptic = (window as any).Telegram.WebApp.HapticFeedback

      switch (type) {
        case 'impact':
          haptic.impactOccurred(style || 'medium')
          break
        case 'notification':
          haptic.notificationOccurred(style || 'success')
          break
        case 'selection':
          haptic.selectionChanged()
          break
      }
    }
  }

  // Показываем toast уведомления в Telegram стиле
  const showTelegramToast = (message: string, duration = 3000) => {
    if (isTelegram && (window as any).Telegram?.WebApp?.showPopup) {
      (window as any).Telegram.WebApp.showPopup({
        title: 'Уведомление',
        message: message,
        buttons: [{ type: 'close' }]
      })
    } else {
      // Fallback - обычный toast
      const toast = document.createElement('div')
      toast.className = `fixed top-4 left-1/2 transform -translate-x-1/2 ${isTelegram ? 'bg-black/80 text-white' : 'bg-blue-600 text-white'} px-4 py-2 rounded-lg shadow-lg z-50 text-sm`
      toast.textContent = message
      document.body.appendChild(toast)

      setTimeout(() => {
        toast.style.opacity = '0'
        toast.style.transition = 'opacity 0.3s'
        setTimeout(() => toast.remove(), 300)
      }, duration)
    }
  }

  return (
    <div
      className={`${className} ${isTelegram ? 'telegram-mini-app' : ''}`}
      style={{
        backgroundColor: isTelegram ? theme.bg_color : undefined,
        color: isTelegram ? theme.text_color : undefined,
        minHeight: '100vh',
        paddingTop: isTelegram ? 'var(--tg-safe-area-inset-top, 0px)' : undefined
      }}
    >
      {children}
    </div>
  )
}

// Экспортируем utility функции для использования в других компонентах
export const telegramUtils = {
  triggerHaptic: (type: 'impact' | 'notification' | 'selection', style?: any) => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
      const haptic = (window as any).Telegram.WebApp.HapticFeedback

      switch (type) {
        case 'impact':
          haptic.impactOccurred(style || 'medium')
          break
        case 'notification':
          haptic.notificationOccurred(style || 'success')
          break
        case 'selection':
          haptic.selectionChanged()
          break
      }
    }
  },

  showToast: (message: string, duration = 3000) => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.showPopup) {
      (window as any).Telegram.WebApp.showPopup({
        title: 'Уведомление',
        message: message,
        buttons: [{ type: 'close' }]
      })
    } else {
      const toast = document.createElement('div')
      toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm'
      toast.textContent = message
      document.body.appendChild(toast)

      setTimeout(() => {
        toast.style.opacity = '0'
        toast.style.transition = 'opacity 0.3s'
        setTimeout(() => toast.remove(), 300)
      }, duration)
    }
  },

  vibrate: (pattern: number | number[]) => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern)
    }
  },

  shareContent: async (text: string, url?: string) => {
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.shareURL) {
      (window as any).Telegram.WebApp.shareURL(url || window.location.href, text)
    } else if (navigator.share) {
      try {
        await navigator.share({
          title: 'TMA Подписка',
          text: text,
          url: url || window.location.href
        })
      } catch (error) {
        console.log('Share cancelled or failed')
      }
    }
  },

  requestClipboard: async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      telegramUtils.showToast('Скопировано в буфер обмена')
    } catch (error) {
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      telegramUtils.showToast('Скопировано в буфер обмена')
    }
  }
}