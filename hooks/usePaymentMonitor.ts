'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiRequest } from '@/lib/utils'

interface PaymentMonitorResult {
  success: boolean
  message?: string
  checked?: number
  processed?: number
  results?: Array<{
    paymentId: string
    status: string
    txHash?: string
  }>
}

interface UsePaymentMonitorOptions {
  interval?: number // в миллисекундах
  autoStart?: boolean
  onPaymentConfirmed?: (paymentId: string, txHash: string) => void
}

export function usePaymentMonitor(options: UsePaymentMonitorOptions = {}) {
  const {
    interval = 10000, // 10 секунд по умолчанию
    autoStart = false,
    onPaymentConfirmed
  } = options

  const [isMonitoring, setIsMonitoring] = useState(false)
  const [lastResult, setLastResult] = useState<PaymentMonitorResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Функция для проверки платежей
  const checkPayments = useCallback(async () => {
    try {
      console.log('🔍 MONITOR: Checking payments...')

      const result = await apiRequest<PaymentMonitorResult>('/api/payment/monitor-v3', {
        method: 'POST'
      })

      console.log('📄 MONITOR: Check result:', result)

      if (result.success && result.data) {
        setLastResult(result.data)
        setError(null)

        // Проверяем, есть ли подтвержденные платежи
        if (result.data.results && onPaymentConfirmed) {
          result.data.results.forEach(paymentResult => {
            if (paymentResult.status === 'confirmed' && paymentResult.txHash) {
              onPaymentConfirmed(paymentResult.paymentId, paymentResult.txHash)
            }
          })
        }

        // Если были обработаны платежи, можно показать уведомление
        if (result.data.processed && result.data.processed > 0) {
          console.log(`✅ MONITOR: Processed ${result.data.processed} payments`)
        }
      } else {
        setError(result.error || 'Ошибка проверки платежей')
      }
    } catch (err) {
      console.error('🔍 MONITOR: Error checking payments:', err)
      setError('Ошибка проверки платежей')
    }
  }, [onPaymentConfirmed])

  // Запуск мониторинга
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return

    console.log('🚀 MONITOR: Starting payment monitoring')
    setIsMonitoring(true)
    setError(null)

    // Сразу делаем первую проверку
    checkPayments()

    // Устанавливаем интервал
    intervalRef.current = setInterval(checkPayments, interval)
  }, [isMonitoring, checkPayments, interval])

  // Остановка мониторинга
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return

    console.log('⏹️ MONITOR: Stopping payment monitoring')
    setIsMonitoring(false)

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [isMonitoring])

  // Ручная проверка
  const manualCheck = useCallback(() => {
    console.log('🔍 MONITOR: Manual payment check')
    checkPayments()
  }, [checkPayments])

  // Автоматический запуск/остановка
  useEffect(() => {
    if (autoStart && !isMonitoring) {
      startMonitoring()
    } else if (!autoStart && isMonitoring) {
      stopMonitoring()
    }
  }, [autoStart, isMonitoring, startMonitoring, stopMonitoring])

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    isMonitoring,
    lastResult,
    error,
    startMonitoring,
    stopMonitoring,
    manualCheck
  }
}