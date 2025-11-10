'use client'

import { useState } from 'react'

interface PromoCodeData {
  id: string
  code: string
  type: string
  discountValue: number
  discountAmount: number
  finalAmount: number
  originalAmount: number
}

interface CurrencyNetworkModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (currency: string, network: string, promoCodeId?: string) => void
  productName: string
  price: number
  loading: boolean
  productId: string
}

interface CurrencyOption {
  symbol: string
  name: string
  icon: string
  networks: NetworkOption[]
  gradient: string
}

interface NetworkOption {
  value: string
  name: string
  icon: string
  color: string
}

const currencies: CurrencyOption[] = [
  {
    symbol: 'USDT',
    name: 'Tether USD',
    icon: '₮',
    gradient: 'from-teal-500 to-cyan-600',
    networks: [
      { value: 'TRX', name: 'Tron (TRC20)', icon: '🔷', color: 'red' },
      { value: 'TON', name: 'Toncoin', icon: '⚡', color: 'blue' },
      { value: 'SOL', name: 'Solana', icon: '🟣', color: 'purple' }
    ]
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '$',
    gradient: 'from-blue-500 to-indigo-600',
    networks: [
      { value: 'TRX', name: 'Tron (TRC20)', icon: '🔷', color: 'red' },
      { value: 'TON', name: 'Toncoin', icon: '⚡', color: 'blue' },
      { value: 'SOL', name: 'Solana', icon: '🟣', color: 'purple' }
    ]
  }
]

export default function CurrencyNetworkModal({
  isOpen,
  onClose,
  onConfirm,
  productName,
  price,
  loading,
  productId
}: CurrencyNetworkModalProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyOption>(currencies[0])
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption>(currencies[0].networks[0])
  const [promoCode, setPromoCode] = useState('')
  const [appliedPromoCode, setAppliedPromoCode] = useState<PromoCodeData | null>(null)
  const [promoCodeLoading, setPromoCodeLoading] = useState(false)
  const [promoCodeError, setPromoCodeError] = useState('')

  // Функция получения Telegram init данных
  const getTelegramInitData = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.hash.slice(1))
      return urlParams.get('tgWebAppData')
    }
    return null
  }

  // Функция валидации промокода
  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoCodeError('')
      return
    }

    setPromoCodeLoading(true)
    setPromoCodeError('')

    try {
      const initData = getTelegramInitData()
      if (!initData) {
        setPromoCodeError('Ошибка авторизации')
        return
      }

      const response = await fetch('/api/promocodes/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(initData && { 'x-telegram-init-data': initData })
        },
        body: JSON.stringify({
          code: promoCode.trim(),
          productId,
          amount: price
        })
      })

      const data = await response.json()

      if (data.success) {
        setAppliedPromoCode(data.data.promoCode)
        setPromoCodeError('')
        setPromoCode('') // Очищаем поле ввода
      } else {
        setPromoCodeError(data.error)
        setAppliedPromoCode(null)
      }
    } catch (error) {
      setPromoCodeError('Ошибка проверки промокода')
      setAppliedPromoCode(null)
    } finally {
      setPromoCodeLoading(false)
    }
  }

  // Функция удаления промокода
  const removePromoCode = () => {
    setAppliedPromoCode(null)
    setPromoCodeError('')
  }

  // Обновляем доступные сети при смене валюты
  const handleCurrencyChange = (currency: CurrencyOption) => {
    setSelectedCurrency(currency)
    setSelectedNetwork(currency.networks[0]) // Выбираем первую сеть для новой валюты
  }

  const handleConfirm = () => {
    onConfirm(selectedCurrency.symbol, selectedNetwork.value, appliedPromoCode?.id)
  }

  // Закрытие модального окна по Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !loading) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className="modal-content max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Выбор способа оплаты</h2>
              <p className="text-sm text-gray-600">Выберите валюту и сеть</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="touch-target w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Информация о продукте */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Продукт:</div>
              <div className="font-semibold text-gray-900">{productName}</div>
            </div>
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              {appliedPromoCode ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500 line-through">
                      ${appliedPromoCode.originalAmount.toFixed(2)}
                    </span>
                    <span className="text-2xl font-bold text-transparent bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text">
                      ${appliedPromoCode.finalAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                      -{appliedPromoCode.type === 'PERCENTAGE' ? `${appliedPromoCode.discountValue}%` : `$${appliedPromoCode.discountValue}`}
                    </span>
                    <span className="text-xs text-gray-600">Промокод: {appliedPromoCode.code}</span>
                  </div>
                </div>
              ) : (
                <div className="text-2xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
                  ${price.toFixed(2)}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500">USD</div>
          </div>
        </div>

        {/* Выбор валюты */}
        <div className="mb-6">
          <label className="form-label">Валюта:</label>
          <div className="grid grid-cols-2 gap-3">
            {currencies.map((currency) => (
              <button
                key={currency.symbol}
                onClick={() => handleCurrencyChange(currency)}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 overflow-hidden group ${
                  selectedCurrency.symbol === currency.symbol
                    ? 'border-blue-500 bg-blue-50 shadow-md transform scale-105'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${currency.gradient} opacity-0 group-hover:opacity-5 transition-opacity`}></div>
                <div className="relative">
                  <div className="text-3xl mb-2">{currency.icon}</div>
                  <div className="font-bold text-gray-900">{currency.symbol}</div>
                  <div className="text-xs text-gray-600 mt-1">{currency.name}</div>
                </div>
                {selectedCurrency.symbol === currency.symbol && (
                  <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Промокод */}
        <div className="mb-6">
          {appliedPromoCode ? (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-green-800">Промокод применен</div>
                    <div className="text-sm text-green-600">{appliedPromoCode.code}</div>
                  </div>
                </div>
                <button
                  onClick={removePromoCode}
                  className="text-red-600 hover:text-red-800 touch-target p-1 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="form-label">Промокод (опционально):</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Введите промокод"
                  className="form-input"
                  disabled={promoCodeLoading}
                  onKeyPress={(e) => e.key === 'Enter' && validatePromoCode()}
                />
                <button
                  onClick={validatePromoCode}
                  disabled={promoCodeLoading || !promoCode.trim()}
                  className="btn btn-primary touch-target"
                >
                  {promoCodeLoading ? (
                    <div className="loading-spinner sm"></div>
                  ) : (
                    'Применить'
                  )}
                </button>
              </div>
              {promoCodeError && (
                <div className="flex items-center space-x-2 text-red-600 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{promoCodeError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Выбор сети */}
        <div className="mb-8">
          <label className="form-label">Сеть:</label>
          <div className="space-y-3">
            {selectedCurrency.networks.map((network) => (
              <button
                key={network.value}
                onClick={() => setSelectedNetwork(network)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 group ${
                  selectedNetwork.value === network.value
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 ${
                    network.color === 'red' ? 'bg-red-100' :
                    network.color === 'blue' ? 'bg-blue-100' :
                    'bg-purple-100'
                  }`}>
                    <span className="text-2xl">{network.icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{network.name}</div>
                    <div className="text-sm text-gray-600">{network.value}</div>
                  </div>
                  {selectedNetwork.value === network.value && (
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 btn btn-secondary touch-target"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 btn btn-primary touch-target bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {loading ? (
              <>
                <div className="loading-spinner sm mr-2"></div>
                <span>Создание...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>
                  Оплатить {selectedCurrency.symbol}
                  {appliedPromoCode && ` ($${appliedPromoCode.finalAmount.toFixed(2)})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}