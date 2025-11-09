'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/utils'

interface PaymentDetails {
  payment_id: string
  payment_status: string
  pay_address: string
  price_amount: number
  price_currency: string
  pay_amount: number
  pay_currency: string
  network?: string
  order_id: string
  order_description: string
  created_at: string
  valid_until: string
}

export default function PaymentPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const paymentId = searchParams.get('payment_id')

  const [payment, setPayment] = useState<PaymentDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>('')

  useEffect(() => {
    if (!paymentId) {
      setError('Отсутствует ID платежа')
      setLoading(false)
      return
    }

    const fetchPaymentDetails = async () => {
      try {
        // Запрашиваем детали платежа из нашего API
        const response = await fetch(`/api/payment/details/${paymentId}`)
        const data = await response.json()

        if (data.success) {
          setPayment(data.payment)
        } else {
          setError(data.error || 'Ошибка загрузки данных платежа')
        }
      } catch (err) {
        setError('Ошибка загрузки данных платежа')
      } finally {
        setLoading(false)
      }
    }

    fetchPaymentDetails()
  }, [paymentId])

  useEffect(() => {
    if (!payment) return

    const updateTimer = () => {
      const now = new Date()
      const validUntil = new Date(payment.valid_until)
      const diff = validUntil.getTime() - now.getTime()

      if (diff > 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeLeft(`${hours}ч ${minutes}м ${seconds}с`)
      } else {
        setTimeLeft('Платеж истек')
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [payment])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('Адрес скопирован в буфер обмена'))
      .catch(() => alert('Ошибка копирования'))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка деталей платежа...</p>
        </div>
      </div>
    )
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Ошибка</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => router.back()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Вернуться назад
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-lg mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-center mb-6">
            <div className="text-green-600 text-4xl mb-4">💳</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Платеж создан</h1>
            <p className="text-gray-600">Отправьте средства на указанный адрес</p>
          </div>

          <div className="space-y-4">
            {/* Детали платежа */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Детали платежа</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Сумма к оплате:</span>
                  <span className="font-medium">{payment.pay_amount} {payment.pay_currency.toUpperCase()}</span>
                </div>
                {payment.network && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Сеть:</span>
                    <span className="font-medium">{payment.network}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Эквивалент:</span>
                  <span className="font-medium">{payment.price_amount} {payment.price_currency.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Статус:</span>
                  <span className="font-medium text-yellow-600">{payment.payment_status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ID платежа:</span>
                  <span className="font-medium text-xs">{payment.payment_id}</span>
                </div>
              </div>
            </div>

            {/* Адрес для оплаты */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Адрес для оплаты</h3>
              <div className="bg-white rounded p-3 mb-3">
                <code className="text-xs break-all">{payment.pay_address}</code>
              </div>
              <button
                onClick={() => copyToClipboard(payment.pay_address)}
                className="w-full bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 text-sm"
              >
                📋 Копировать адрес
              </button>
            </div>

            {/* Таймер */}
            {timeLeft && !timeLeft.includes('истек') && (
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">Время до истечения:</div>
                <div className="text-lg font-semibold text-orange-600">{timeLeft}</div>
              </div>
            )}

            {/* Инструкции */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Инструкции</h3>
              <ol className="text-sm text-gray-600 space-y-2">
                <li>1. Скопируйте адрес для оплаты</li>
                <li>2. Отправьте точную сумму {payment.pay_amount} {payment.pay_currency.toUpperCase()}</li>
                {payment.network && <li>3. Убедитесь, что используете сеть: {payment.network}</li>}
                <li>{payment.network ? '4' : '3'}. Дождитесь подтверждения платежа</li>
                <li>{payment.network ? '5' : '4'}. Вы будете перенаправлены автоматически после успешной оплаты</li>
              </ol>
            </div>

            {/* Кнопка проверки статуса */}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              🔄 Проверить статус
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}