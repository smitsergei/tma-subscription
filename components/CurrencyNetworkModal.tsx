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
    <div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="modal-content w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 pt-6 pb-4 px-6 border-b border-gray-100 dark:border-gray-700 z-10 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h2 id="modal-title" className="text-xl font-bold text-gray-900 dark:text-white">Выбор оплаты</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Валюта и сеть транзакции</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              aria-label="Закрыть"
              className="touch-target w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-all duration-200 disabled:opacity-50"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Основной контент */}
        <div className="px-6 py-4 space-y-6">
          {/* Информация о продукте */}
          <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-800 dark:via-gray-750 dark:to-gray-800 rounded-2xl p-5 border border-white/50 dark:border-gray-600 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-2">Продукт</div>
                <div className="text-lg font-bold text-gray-900 dark:text-white mb-1">{productName}</div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Доступно для покупки</span>
                </div>
              </div>
              <div className="w-14 h-14 bg-white dark:bg-gray-700 rounded-2xl flex items-center justify-center shadow-lg border border-white/20 dark:border-gray-600">
                <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                {appliedPromoCode ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400 line-through">
                        ${appliedPromoCode.originalAmount.toFixed(2)}
                      </span>
                      <span className="text-3xl font-bold text-transparent bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text">
                        ${appliedPromoCode.finalAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 dark:text-green-700 px-3 py-1 rounded-full font-semibold border border-green-200">
                        -{appliedPromoCode.type === 'PERCENTAGE' ? `${appliedPromoCode.discountValue}%` : `$${appliedPromoCode.discountValue}`}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">Промокод: {appliedPromoCode.code}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-3xl font-bold text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text">
                    ${price.toFixed(2)}
                  </div>
                )}
              </div>
              <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-700/50 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600">USD</div>
            </div>
          </div>

          {/* Выбор валюты */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-900 dark:text-white">Валюта</label>
              <span className="text-xs text-gray-500 dark:text-gray-400">Выберите стабильную монету</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {currencies.map((currency) => (
                <button
                  key={currency.symbol}
                  onClick={() => handleCurrencyChange(currency)}
                  className={`relative p-4 rounded-2xl border-2 transition-all duration-300 overflow-hidden group ${
                    selectedCurrency.symbol === currency.symbol
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-lg transform scale-[1.02]'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${currency.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                  <div className="relative z-10">
                    <div className={`text-4xl mb-2 transition-transform duration-300 group-hover:scale-110 ${
                      selectedCurrency.symbol === currency.symbol ? 'animate-pulse' : ''
                    }`}>{currency.icon}</div>
                    <div className={`font-bold text-lg ${
                      selectedCurrency.symbol === currency.symbol
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-900 dark:text-white'
                    }`}>{currency.symbol}</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{currency.name}</div>
                  </div>
                  {selectedCurrency.symbol === currency.symbol && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
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
            <div>
              {appliedPromoCode ? (
                <div className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20 border border-green-200 dark:border-green-700 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-bold text-green-800 dark:text-green-300">Промокод применен!</div>
                        <div className="text-sm text-green-600 dark:text-green-400 font-mono">{appliedPromoCode.code}</div>
                      </div>
                    </div>
                    <button
                      onClick={removePromoCode}
                      aria-label="Удалить промокод"
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 touch-target p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-900 dark:text-white">Промокод</label>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Если имеется</span>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="Введите промокод"
                        className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all duration-200"
                        disabled={promoCodeLoading}
                        onKeyPress={(e) => e.key === 'Enter' && validatePromoCode()}
                      />
                      {promoCode && (
                        <button
                          onClick={() => setPromoCode('')}
                          aria-label="Очистить"
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <button
                      onClick={validatePromoCode}
                      disabled={promoCodeLoading || !promoCode.trim()}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none"
                    >
                      {promoCodeLoading ? (
                        <div className="loading-spinner sm w-5 h-5"></div>
                      ) : (
                        'Применить'
                      )}
                    </button>
                  </div>
                  {promoCodeError && (
                    <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-red-700 dark:text-red-300 text-sm font-medium">{promoCodeError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Выбор сети */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-900 dark:text-white">Сеть блокчейн</label>
                <span className="text-xs text-gray-500 dark:text-gray-400">Выберите сеть</span>
              </div>
              <div className="space-y-3">
                {selectedCurrency.networks.map((network) => (
                  <button
                    key={network.value}
                    onClick={() => setSelectedNetwork(network)}
                    className={`w-full p-4 rounded-2xl border-2 text-left transition-all duration-300 group ${
                      selectedNetwork.value === network.value
                        ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-md transform scale-[1.01]'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mr-4 shadow-sm transition-all duration-300 group-hover:scale-110 ${
                        network.color === 'red' ? 'bg-gradient-to-br from-red-100 to-pink-100 dark:from-red-900/20 dark:to-pink-900/20' :
                        network.color === 'blue' ? 'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20' :
                        'bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900/20 dark:to-violet-900/20'
                      }`}>
                        <span className="text-3xl">{network.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className={`font-bold text-lg mb-1 ${
                          selectedNetwork.value === network.value
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-900 dark:text-white'
                        }`}>{network.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg inline-block">
                          {network.value}
                        </div>
                      </div>
                      {selectedNetwork.value === network.value && (
                        <div className="w-7 h-7 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Футер с кнопками */}
          <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 px-6 py-4 rounded-b-3xl">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-6 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-xl disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <div className="loading-spinner sm w-5 h-5 mr-2"></div>
                    <span>Создание...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </div>
  )
}