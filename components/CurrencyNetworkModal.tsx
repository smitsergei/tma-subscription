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
}

interface NetworkOption {
  value: string
  name: string
  icon: string
}

const currencies: CurrencyOption[] = [
  {
    symbol: 'USDT',
    name: 'Tether USD',
    icon: '₮',
    networks: [
      { value: 'TRX', name: 'Tron (TRC20)', icon: '🔷' },
      { value: 'TON', name: 'Toncoin', icon: '⚡' },
      { value: 'SOL', name: 'Solana', icon: '🟣' }
    ]
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: '$',
    networks: [
      { value: 'TRX', name: 'Tron (TRC20)', icon: '🔷' },
      { value: 'TON', name: 'Toncoin', icon: '⚡' },
      { value: 'SOL', name: 'Solana', icon: '🟣' }
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <h2 className="text-lg font-semibold mb-4">💳 Выбор способа оплаты</h2>

        {/* Информация о продукте */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-600">Продукт:</div>
          <div className="font-medium">{productName}</div>
          <div className="mt-2">
            {appliedPromoCode ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 line-through">${appliedPromoCode.originalAmount.toFixed(2)}</span>
                  <span className="text-lg font-bold text-green-600">${appliedPromoCode.finalAmount.toFixed(2)}</span>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    -{appliedPromoCode.type === 'PERCENTAGE' ? `${appliedPromoCode.discountValue}%` : `$${appliedPromoCode.discountValue}`}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">Промокод: {appliedPromoCode.code}</div>
              </>
            ) : (
              <div className="text-lg font-bold text-blue-600">${price.toFixed(2)}</div>
            )}
          </div>
        </div>

        {/* Выбор валюты */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Валюта:</label>
          <div className="grid grid-cols-2 gap-2">
            {currencies.map((currency) => (
              <button
                key={currency.symbol}
                onClick={() => handleCurrencyChange(currency)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedCurrency.symbol === currency.symbol
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">{currency.icon}</div>
                <div className="font-medium">{currency.symbol}</div>
                <div className="text-xs text-gray-500">{currency.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Промокод */}
        <div className="mb-4">
          {appliedPromoCode ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-green-700 font-medium">✅ Промокод применен</span>
                  <span className="text-sm text-green-600">{appliedPromoCode.code}</span>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    -{appliedPromoCode.type === 'PERCENTAGE' ? `${appliedPromoCode.discountValue}%` : `$${appliedPromoCode.discountValue}`}
                  </span>
                </div>
                <button
                  onClick={removePromoCode}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Удалить
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Промокод (опционально):</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Введите промокод"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={promoCodeLoading}
                />
                <button
                  onClick={validatePromoCode}
                  disabled={promoCodeLoading || !promoCode.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {promoCodeLoading ? '...' : 'Применить'}
                </button>
              </div>
              {promoCodeError && (
                <div className="text-red-600 text-xs mt-1">{promoCodeError}</div>
              )}
            </div>
          )}
        </div>

        {/* Выбор сети */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Сеть:</label>
          <div className="space-y-2">
            {selectedCurrency.networks.map((network) => (
              <button
                key={network.value}
                onClick={() => setSelectedNetwork(network)}
                className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                  selectedNetwork.value === network.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <span className="text-xl mr-3">{network.icon}</span>
                  <div>
                    <div className="font-medium">{network.name}</div>
                    <div className="text-xs text-gray-500">{network.value}</div>
                  </div>
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
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2 animate-spin"></div>
                Создание...
              </>
            ) : (
              `Оплатить ${selectedCurrency.symbol}${appliedPromoCode ? ` ($${appliedPromoCode.finalAmount.toFixed(2)})` : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}