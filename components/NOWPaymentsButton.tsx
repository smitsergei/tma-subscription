'use client'

import { useState } from 'react'

interface NOWPaymentsButtonProps {
  isLoading: boolean
  error: string | null
  onPayment: (amount: number, currency: string) => void
}

export function NOWPaymentsButton({
  isLoading,
  error,
  onPayment
}: NOWPaymentsButtonProps) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USDT')
  const [showPaymentInfo, setShowPaymentInfo] = useState(false)

  const handlePayment = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Пожалуйста, введите корректную сумму')
      return
    }

    console.log('💳 NOWPaymentsButton: Initiate payment')
    try {
      // Показываем информацию для Telegram
      if (window.Telegram?.WebApp && window.Telegram.WebApp.showConfirm) {
        window.Telegram.WebApp.showConfirm(
          `Оплата через NOWPayments:\n\nСумма: ${amount} ${currency}\n\nВы будете перенаправлены на страницу оплаты.\n\nПродолжить?`,
          (confirmed: boolean) => {
            if (confirmed) {
              setShowPaymentInfo(true)
              onPayment(parseFloat(amount), currency)
            }
          }
        )
      } else {
        // Для браузера
        setShowPaymentInfo(true)
        onPayment(parseFloat(amount), currency)
      }
    } catch (err) {
      console.error('❌ NOWPaymentsButton: Payment error:', err)
      // В случае ошибки все равно пытаемся создать платеж
      onPayment(parseFloat(amount), currency)
    }
  }

  const currencies = [
    { value: 'USDT', label: 'USDT (TRC20)' },
    { value: 'USDC', label: 'USDC (ERC20)' },
    { value: 'BTC', label: 'Bitcoin' },
    { value: 'ETH', label: 'Ethereum' },
    { value: 'LTC', label: 'Litecoin' },
    { value: 'BCH', label: 'Bitcoin Cash' }
  ]

  return (
    <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
      {error && (
        <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Сумма оплаты:
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Введите сумму"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Криптовалюта:
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isLoading}
          >
            {currencies.map((curr) => (
              <option key={curr.value} value={curr.value}>
                {curr.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-center">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full mr-2"></div>
              <span className="text-purple-600">Создание платежа...</span>
            </div>
          ) : (
            <button
              onClick={handlePayment}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center justify-center"
              disabled={!amount || parseFloat(amount) <= 0}
            >
              <span className="mr-2">💳</span>
              Оплатить через NOWPayments
            </button>
          )}
        </div>

        {!isLoading && (
          <div className="mt-3 text-xs text-gray-600">
            Принимаем: Bitcoin, Ethereum, USDT, USDC и другие криптовалюты
          </div>
        )}
      </div>

      {showPaymentInfo && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">📱 Информация об оплате:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Вы будете перенаправлены на защищенную страницу NOWPayments</li>
            <li>• Выберите удобную криптовалюту для оплаты</li>
            <li>• Следуйте инструкциям на странице оплаты</li>
            <li>• Оплата будет зачислена автоматически</li>
          </ul>
          <button
            onClick={() => setShowPaymentInfo(false)}
            className="mt-2 text-xs text-yellow-600 hover:text-yellow-800"
          >
            Скрыть информацию
          </button>
        </div>
      )}
    </div>
  )
}