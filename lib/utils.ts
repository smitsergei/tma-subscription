import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// Глобальные типы для Telegram WebApp
declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string
        initDataUnsafe: {
          query_id?: string
          user?: {
            id: number
            first_name?: string
            last_name?: string
            username?: string
            language_code?: string
            is_premium?: boolean
          }
          auth_date?: string
          hash?: string
        }
        ready: () => void
        expand: () => void
        close: () => void
        enableClosingConfirmation: () => void
        setHeaderColor: (color: string) => void
        themeParams: {
          bg_color?: string
          text_color?: string
          button_color?: string
          button_text_color?: string
          secondary_bg_color?: string
          section_separator_color?: string
        }
        onEvent: (eventType: string, callback: () => void) => void
        showAlert?: (message: string) => void
        showConfirm?: (message: string, callback: (confirmed: boolean) => void) => void
        BackButton?: {
          show: () => void
          hide: () => void
          onClick: (callback: () => void) => void
          offClick: (callback: () => void) => void
        }
      }
    }
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Форматирование даты
export function formatDate(date: Date | string, locale: string = 'ru-RU'): string {
  const d = new Date(date)
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Форматирование оставшегося времени
export function formatTimeLeft(expiresAt: Date | string): string {
  const now = new Date()
  const expires = new Date(expiresAt)
  const diff = expires.getTime() - now.getTime()

  if (diff <= 0) {
    return 'Истекла'
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) {
    return `${days} д ${hours} ч`
  } else if (hours > 0) {
    return `${hours} ч ${minutes} мин`
  } else {
    return `${minutes} мин`
  }
}

// Форматирование цены
export function formatPrice(price: number, currency: string = 'USDT'): string {
  return `${price.toFixed(2)} ${currency}`
}

// Проверка активности подписки
export function isSubscriptionActive(expiresAt: Date | string): boolean {
  return new Date(expiresAt) > new Date()
}

// Генерация уникального memo для платежа
export function generatePaymentMemo(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `TMA_SUB_${timestamp}_${random}`
}

// Валидация Telegram WebApp init data
export function validateTelegramInitData(initData: string, botToken: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')

    if (!hash) {
      return false
    }

    // Удаляем hash из параметров для проверки
    urlParams.delete('hash')

    // Создаем строку для проверки
    const authDateString = urlParams.get('auth_date')
    const userString = urlParams.get('user')

    // В реальном приложении здесь должна быть проверка HMAC-SHA256
    // Для примера возвращаем true
    // В production нужно использовать crypto-api для проверки подписи

    return true
  } catch (error) {
    console.error('Error validating Telegram init data:', error)
    return false
  }
}

// Конвертация наноTON в TON
export function nanoTonToTon(nanoTon: string): number {
  return parseFloat(nanoTon) / 1000000000
}

// Конвертация TON в наноTON
export function tonToNanoTon(ton: number): string {
  return (ton * 1000000000).toString()
}

// Проверка валидности адреса TON
export function isValidTonAddress(address: string): boolean {
  // Простая проверка формата адреса TON
  const tonAddressRegex = /^0:[a-fA-F0-9]{64}$/
  return tonAddressRegex.test(address)
}

// Кэширование данных
export class Cache {
  private static cache = new Map<string, { data: any; expiry: number }>()

  static set(key: string, data: any, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000
    })
  }

  static get<T>(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  static clear(): void {
    this.cache.clear()
  }

  static delete(key: string): boolean {
    return this.cache.delete(key)
  }
}

// API запросы с обработкой ошибок
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    // Получаем Telegram WebApp initData
    const telegramWebApp = window.Telegram?.WebApp
    const initData = telegramWebApp?.initData

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        // Добавляем заголовок с Telegram initData если доступен
        ...(initData && { 'X-Telegram-Init-Data': initData }),
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP error! status: ${response.status}`
      }
    }

    return {
      success: true,
      data
    }
  } catch (error) {
    console.error('API request error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Проверка подписи NOWPayments IPN
export async function verifyNOWPaymentsIPN(
  ipnData: any,
  signature: string,
  ipnSecret: string
): Promise<boolean> {
  try {
    // Создаем строку для HMAC
    const sortedKeys = Object.keys(ipnData).sort()
    const message = sortedKeys
      .map(key => `${key}:${ipnData[key]}`)
      .join(';')

    // Для проверки подписи в Node.js используем crypto
    const crypto = require('crypto')
    const hmac = crypto
      .createHmac('sha512', ipnSecret)
      .update(message)
      .digest('hex')

    return hmac === signature.toLowerCase()
  } catch (error) {
    console.error('Error verifying NOWPayments IPN signature:', error)
    return false
  }
}

// Получение поддерживаемых криптовалют NOWPayments
export async function getNOWPaymentsSupportedCurrencies(): Promise<string[]> {
  try {
    const apiKey = process.env.NOWPAYMENTS_API_KEY
    if (!apiKey) {
      throw new Error('NOWPayments API ключ не настроен')
    }

    const response = await fetch('https://api.nowpayments.io/v1/currencies', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Возвращаем только активные криптовалюты
    return data.currencies
      .filter((currency: any) => currency.active)
      .map((currency: any) => currency.ticker)
      .sort()
  } catch (error) {
    console.error('Error fetching NOWPayments currencies:', error)
    // Возвращаем популярные валюты по умолчанию
    return ['BTC', 'ETH', 'USDT', 'USDC', 'LTC', 'BCH']
  }
}

// Функция для преобразования текста с переносами строк в массив строк
export function formatTextWithLineBreaks(text: string): string[] {
  if (!text) return []

  // Разделяем текст по переносам строк
  return text.split('\n')
}