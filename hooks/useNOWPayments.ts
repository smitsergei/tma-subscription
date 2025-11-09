'use client'

import { useState, useCallback } from 'react'

interface NOWPaymentData {
  payment_id: string
  payment_amount: number
  pay_amount: number
  pay_currency: string
  order_id: string
  order_description: string
  purchase_id: string
  invoice_id: string
  updated_at: string
  created_at: string
  expiration_estimate_date: string
  ipn_callback_url: string
  success_url: string
  partially_paid_url: string
  payment_status: string
  payment_currency: string
  price_amount: number
  price_currency: string
}

export function useNOWPayments() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentData, setPaymentData] = useState<NOWPaymentData | null>(null)

  const initiatePayment = useCallback(async (
    amount: number,
    currency: string,
    orderDescription?: string,
    productId?: string
  ): Promise<NOWPaymentData | null> => {
    console.log(`💳 Initiating NOWPayments payment: ${amount} ${currency}`)
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency,
          productId,
          orderDescription: orderDescription || `Оплата подписки ${amount} ${currency}`
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка создания платежа')
      }

      const data = await response.json()
      console.log('✅ Payment initiated:', data)

      // Сохраняем данные платежа
      setPaymentData(data.payment)

      // Если есть URL для оплаты, перенаправляем пользователя
      if (data.payment?.payment_url) {
        console.log('🔄 Redirecting to payment page:', data.payment.payment_url)

        // Перенаправляем на страницу оплаты
        window.location.href = data.payment.payment_url
      }

      return data.payment
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при создании платежа'
      console.error('❌ Payment initiation error:', err)
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const checkPaymentStatus = useCallback(async (paymentId: string): Promise<string | null> => {
    console.log(`🔍 Checking payment status: ${paymentId}`)
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/payment/check-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка проверки статуса платежа')
      }

      const data = await response.json()
      console.log('✅ Payment status checked:', data.payment_status)

      // Обновляем данные платежа если они пришли
      if (data.payment) {
        setPaymentData(data.payment)
      }

      return data.payment_status
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при проверке статуса'
      console.error('❌ Payment status check error:', err)
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getMinimumAmount = useCallback(async (currency: string): Promise<number | null> => {
    console.log(`💰 Getting minimum amount for ${currency}`)

    try {
      const response = await fetch(`/api/payment/minimum-amount?currency=${currency}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка получения минимальной суммы')
      }

      const data = await response.json()
      console.log('✅ Minimum amount received:', data)

      return data.minimum_amount
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка получения минимальной суммы'
      console.error('❌ Minimum amount error:', err)
      setError(errorMessage)
      return null
    }
  }, [])

  const getEstimatedAmount = useCallback(async (
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number | null> => {
    console.log(`💰 Estimating ${amount} ${fromCurrency} to ${toCurrency}`)

    try {
      const response = await fetch('/api/payment/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency_from: fromCurrency,
          currency_to: toCurrency
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка расчета суммы')
      }

      const data = await response.json()
      console.log('✅ Amount estimated:', data)

      return data.estimated_amount
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Ошибка расчета суммы'
      console.error('❌ Amount estimation error:', err)
      setError(errorMessage)
      return null
    }
  }, [])

  const clearPaymentData = useCallback(() => {
    setPaymentData(null)
    setError(null)
  }, [])

  return {
    isLoading,
    error,
    paymentData,
    initiatePayment,
    checkPaymentStatus,
    getMinimumAmount,
    getEstimatedAmount,
    clearPaymentData,
  }
}