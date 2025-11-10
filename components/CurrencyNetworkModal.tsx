'use client'

import { useState } from 'react'

interface CurrencyNetworkModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (currency: string, network: string) => void
  productName: string
  price: number
  loading: boolean
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
  loading
}: CurrencyNetworkModalProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyOption>(currencies[0])
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption>(currencies[0].networks[0])

  // Обновляем доступные сети при смене валюты
  const handleCurrencyChange = (currency: CurrencyOption) => {
    setSelectedCurrency(currency)
    setSelectedNetwork(currency.networks[0]) // Выбираем первую сеть для новой валюты
  }

  const handleConfirm = () => {
    onConfirm(selectedCurrency.symbol, selectedNetwork.value)
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
          <div className="text-lg font-bold text-blue-600 mt-1">${price.toFixed(2)}</div>
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
              `Оплатить ${selectedCurrency.symbol}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}