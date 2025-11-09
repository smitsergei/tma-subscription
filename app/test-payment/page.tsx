'use client'

import { useState, useEffect } from 'react'
import { apiRequest, formatPrice } from '@/lib/utils'
import { Product, PaymentInitiateResponse } from '@/types'
import { PaymentMonitor } from '@/components/PaymentMonitor'

export default function TestPaymentPage() {
  const [result, setResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const response = await fetch('https://tma-subscription-grbjflqfp-smits-projects-3d9ec8f0.vercel.app/api/products')
      const data = await response.json()
      if (data.success) {
        setProducts(data.data)
      }
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const testPaymentInitiation = async (productId: string) => {
    setIsLoading(true)
    setResult('')

    try {
      // Эмулируем Telegram WebApp данные
      const mockInitData = 'query_id=12345&user=%7B%22id%22%3A123456%2C%22first_name%22%3A%22Test%22%7D&auth_date=1234567890&hash=test_hash'

      const response = await fetch('https://tma-subscription-grbjflqfp-smits-projects-3d9ec8f0.vercel.app/api/payment/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Init-Data': mockInitData
        },
        body: JSON.stringify({
          productId
        })
      })

      const data = await response.json()

      if (data.success) {
        setResult(`✅ Успешно!\n\nPayment ID: ${data.data.paymentId}\nAmount: ${data.data.amount} ${data.data.currency}\nMemo: ${data.data.memo}\n\nTransaction data: ${JSON.stringify(data.data.transaction, null, 2)}`)
      } else {
        setResult(`❌ Ошибка: ${data.error}`)
      }
    } catch (error) {
      console.error('Test payment error:', error)
      setResult(`❌ Ошибка: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Обработчик подтверждения платежа
  const handlePaymentConfirmed = (paymentId: string, txHash: string) => {
    setResult(`✅ Платеж подтвержден!\n\nPayment ID: ${paymentId}\nTX Hash: ${txHash}\n\nПользователь добавлен в канал и подписка активирована.`)

    // Обновляем список продуктов
    loadProducts()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">🧪 Тестирование платежей</h1>

        {/* Мониторинг платежей */}
        <PaymentMonitor
          autoStart={true}
          onPaymentConfirmed={handlePaymentConfirmed}
        />

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Доступные продукты:</h2>

          {products.length === 0 ? (
            <p className="text-gray-500">Загрузка...</p>
          ) : (
            <div className="space-y-4">
              {products.map((product) => (
                <div key={product.productId} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg">{product.name}</h3>
                  {product.description && (
                    <p className="text-gray-600 mb-2">{product.description}</p>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-2xl font-bold text-green-600">
                      {product.discountPrice && product.discountPrice < product.price ? (
                        <>
                          <span className="text-gray-400 line-through text-lg mr-2">
                            {formatPrice(product.price)}
                          </span>
                          {formatPrice(product.discountPrice)}
                        </>
                      ) : (
                        formatPrice(product.price)
                      )}
                    </div>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {product.periodDays} дней
                    </span>
                  </div>
                  <button
                    onClick={() => testPaymentInitiation(product.productId)}
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {isLoading ? 'Тестирование...' : '🧪 Тестировать иницииацию платежа'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Результат теста:</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap overflow-x-auto">
              {result}
            </pre>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
          <h3 className="font-semibold text-yellow-800 mb-2">📝 Инструкция по тестированию:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Нажмите кнопку "Тестировать иницииацию платежа" для выбранного продукта</li>
            <li>Проверьте ответ API в поле "Результат теста"</li>
<li>Если успешно, можно проверить полную интеграцию в Telegram мини-приложении</li>
            <li>URL мини-приложения: <a href="https://tma-subscription-grbjflqfp-smits-projects-3d9ec8f0.vercel.app/app" target="_blank" className="text-blue-600 underline">https://tma-subscription-grbjflqfp-smits-projects-3d9ec8f0.vercel.app/app</a></li>
          </ol>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
          <h3 className="font-semibold text-green-800 mb-2">✅ Что было исправлено:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Добавлена автоматическая отправка Telegram initData в API запросах</li>
            <li>Добавлено детальное логирование для отладки процесса оплаты</li>
            <li>Улучшена обработка ошибок</li>
            <li>Добавлены глобальные типы для Telegram WebApp</li>
            <li>Создана система мониторинга платежей через API v3 Toncenter</li>
            <li>Добавлена проверка pending actions для отслеживания транзакций</li>
          </ul>
        </div>

        {/* Тестирование API v3 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h3 className="font-semibold text-blue-800 mb-2">🔧 Тестирование API v3:</h3>
          <div className="space-y-3">
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/payment/monitor-v3?checkActions=true')
                  const data = await response.json()
                  setResult(`📊 Pending Actions:\n\n${JSON.stringify(data, null, 2)}`)
                } catch (error) {
                  setResult(`❌ Ошибка: ${error.message}`)
                }
              }}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 text-sm"
            >
              Проверить Pending Actions
            </button>

            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/test/create-test-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      productId: products[0]?.productId || 'test-product',
                      userId: '123456',
                      amount: 0.1
                    })
                  })
                  const data = await response.json()
                  if (data.success) {
                    setResult(`✅ Тестовый платеж создан:\n\nPayment ID: ${data.data.paymentId}\nMemo: ${data.data.memo}\nСумма: ${data.data.amount} ${data.data.currency}\n\n${JSON.stringify(data.data.testInstructions, null, 2)}`)
                  } else {
                    setResult(`❌ Ошибка: ${data.error}`)
                  }
                } catch (error) {
                  setResult(`❌ Ошибка: ${error.message}`)
                }
              }}
              disabled={products.length === 0}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm"
            >
              Создать тестовый платеж
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}