'use client'

import { useState } from 'react'
import { usePaymentMonitor } from '@/hooks/usePaymentMonitor'

interface PaymentMonitorProps {
  autoStart?: boolean
  onPaymentConfirmed?: (paymentId: string, txHash: string) => void
}

export function PaymentMonitor({
  autoStart = false,
  onPaymentConfirmed
}: PaymentMonitorProps) {
  const [showDetails, setShowDetails] = useState(false)

  const {
    isMonitoring,
    lastResult,
    error,
    startMonitoring,
    stopMonitoring,
    manualCheck
  } = usePaymentMonitor({
    interval: 15000, // 15 секунд
    autoStart,
    onPaymentConfirmed
  })

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            isMonitoring ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`}></div>
          <h3 className="font-semibold text-sm">
            Мониторинг платежей
          </h3>
          <span className="text-xs text-gray-500">
            {isMonitoring ? 'Активен' : 'Неактивен'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {!isMonitoring ? (
            <button
              onClick={startMonitoring}
              className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
            >
              Запустить
            </button>
          ) : (
            <button
              onClick={stopMonitoring}
              className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
            >
              Остановить
            </button>
          )}

          <button
            onClick={manualCheck}
            disabled={isMonitoring}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Проверить
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-gray-600 hover:text-gray-800"
          >
            {showDetails ? 'Скрыть' : 'Подробнее'}
          </button>
        </div>
      </div>

      {/* Статус */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
          <p className="text-xs text-red-700">⚠️ {error}</p>
        </div>
      )}

      {lastResult && (
        <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-3">
          <p className="text-xs text-blue-700">
            {lastResult.message}
          </p>
          {lastResult.checked !== undefined && (
            <p className="text-xs text-blue-600 mt-1">
              Проверено: {lastResult.checked} | Обработано: {lastResult.processed || 0}
            </p>
          )}
        </div>
      )}

      {/* Детальная информация */}
      {showDetails && lastResult?.results && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">
            Результаты проверки:
          </h4>
          <div className="space-y-1">
            {lastResult.results.map((result, index) => (
              <div
                key={index}
                className={`text-xs p-2 rounded ${
                  result.status === 'confirmed'
                    ? 'bg-green-50 text-green-800'
                    : 'bg-yellow-50 text-yellow-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">
                    {result.paymentId.slice(0, 8)}...
                  </span>
                  <span className="font-medium">
                    {result.status === 'confirmed' ? '✅ Подтвержден' : '⏳ Ожидает'}
                  </span>
                </div>
                {result.txHash && (
                  <div className="mt-1 text-xs opacity-75">
                    TX: {result.txHash.slice(0, 16)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Информация */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-600">
          💡 Мониторинг автоматически проверяет статус ожидающих платежей каждые 15 секунд.
          При подтверждении платежа пользователь будет автоматически добавлен в канал.
        </p>
      </div>
    </div>
  )
}