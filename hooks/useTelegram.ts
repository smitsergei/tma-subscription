'use client'

import { useState, useEffect } from 'react'
import { TelegramUser } from '@/types'

export function useTelegram() {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInTelegram, setIsInTelegram] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initTelegram = () => {
      try {
        // Проверяем, что мы в Telegram Web App
        if (!window.Telegram?.WebApp) {
          setIsLoading(false)
          setIsInTelegram(false)
          setError('Приложение должно быть открыто через Telegram')
          return
        }

        const tg = window.Telegram.WebApp
        setIsInTelegram(true)

        // Получаем данные пользователя
        const userData = tg.initDataUnsafe.user
        if (!userData) {
          setError('Не удалось получить данные пользователя')
          setIsLoading(false)
          return
        }

        setUser(userData)
        setIsLoading(false)

        // Настраиваем Web App
        tg.ready()
        tg.expand()
        tg.enableClosingConfirmation()

        // Устанавливаем заголовок
        tg.setHeaderColor('secondary_bg_color')

        // Кнопка "назад" доступна в новых версиях WebApp API
        if (tg.BackButton) {
          tg.BackButton.show()
          tg.onEvent('backButtonClicked', () => {
            tg.close()
          })
        }

      } catch (err) {
        console.error('Telegram initialization error:', err)
        setError('Ошибка инициализации Telegram')
        setIsLoading(false)
      }
    }

    // Инициализация с небольшой задержкой для уверенности, что Telegram SDK загружен
    const timer = setTimeout(initTelegram, 100)

    return () => clearTimeout(timer)
  }, [])

  const showAlert = (message: string) => {
    if (window.Telegram?.WebApp?.showAlert) {
      window.Telegram.WebApp.showAlert(message)
    } else {
      alert(message)
    }
  }

  const showConfirm = (message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Telegram?.WebApp?.showConfirm) {
        window.Telegram.WebApp.showConfirm(message, (confirmed) => {
          resolve(confirmed)
        })
      } else {
        resolve(confirm(message))
      }
    })
  }

  const closeApp = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.close()
    }
  }

  return {
    user,
    isLoading,
    isInTelegram,
    error,
    showAlert,
    showConfirm,
    closeApp,
    webApp: window.Telegram?.WebApp
  }
}