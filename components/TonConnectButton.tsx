'use client'

import { useState } from 'react'

interface TonConnectButtonProps {
  isConnected: boolean
  isLoading: boolean
  error: string | null
  address: string | null
  onConnect: () => void
  onDisconnect: () => void
}

export function TonConnectButton({
  isConnected,
  isLoading,
  error,
  address,
  onConnect,
  onDisconnect
}: TonConnectButtonProps) {
  const [showInstructions, setShowInstructions] = useState(false)

  const handleConnect = async () => {
    console.log('🔗 TonConnectButton: Connect clicked')
    try {
      // Показываем инструкции для Telegram
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.showConfirm(
          'Для подключения кошелька TON вам нужно:\n\n1. Открыть мобильный Telegram\n2. Нажать на ссылку ниже\n3. Выбрать кошелек (Tonkeeper, MyTonWallet и т.д.)\n\nПродолжить?',
          (confirmed: boolean) => {
            if (confirmed) {
              setShowInstructions(true)
              onConnect()
            }
          }
        )
      } else {
        // Для браузера
        setShowInstructions(true)
        onConnect()
      }
    } catch (err) {
      console.error('❌ TonConnectButton: Connect error:', err)
      // В случае ошибки все равно пытаемся подключиться
      onConnect()
    }
  }

  const handleDisconnect = async () => {
    console.log('🔌 TonConnectButton: Disconnect clicked')
    try {
      onDisconnect()
    } catch (err) {
      console.error('❌ TonConnectButton: Disconnect error:', err)
    }
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
          <div>
            <p className="text-sm font-medium text-green-800">
              💼 Кошелек подключен
            </p>
            <p className="text-xs text-green-600 font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
        >
          Отключить
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      {error && (
        <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      <div className="text-center">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mr-2"></div>
            <span className="text-blue-600">Подключение...</span>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <span className="mr-2">🔗</span>
            Подключить TON кошелек
          </button>
        )}

        {!isLoading && (
          <div className="mt-3 text-xs text-gray-600">
            Поддерживаются: Tonkeeper, MyTonWallet, OpenMask
          </div>
        )}
      </div>

      {showInstructions && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">📱 Инструкция для Telegram:</h4>
          <ol className="text-sm text-yellow-700 space-y-1">
            <li>1. Нажмите кнопку выше</li>
            <li>2. Выберите ваш кошелек в появившемся списке</li>
            <li>3. Подтвердите подключение в кошельке</li>
            <li>4. Готово! Вы можете делать покупки</li>
          </ol>
          <button
            onClick={() => setShowInstructions(false)}
            className="mt-2 text-xs text-yellow-600 hover:text-yellow-800"
          >
            Скрыть инструкции
          </button>
        </div>
      )}
    </div>
  )
}