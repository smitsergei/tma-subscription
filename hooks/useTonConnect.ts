'use client'

import { useState, useEffect, useCallback } from 'react'
import { TonConnection, PaymentTransaction } from '@/types'

declare global {
  interface Window {
    tonconnect?: any
  }
}

export function useTonConnect() {
  const [connection, setConnection] = useState<TonConnection | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Инициализация TON Connect
    const initTonConnect = async () => {
      try {
        // Динамический импорт TON Connect SDK
        const { TonConnect } = await import('@tonconnect/sdk')

        // Используем локальный manifest для разработки и production для продакшена
        const isDevelopment = process.env.NODE_ENV === 'development'
        const manifestUrl = isDevelopment
          ? `http://localhost:3009/tonconnect-manifest-local.json`
          : `${process.env.NEXT_PUBLIC_APP_URL}/tonconnect-manifest.json`

        console.log('🔗 TON Connect manifest URL:', manifestUrl)

        const tonConnection = new TonConnect({
          manifestUrl,
        })

        setConnection({
          connect: async (walletsList?: any) => {
            setIsLoading(true)
            setError(null)
            try {
              await tonConnection.connect(walletsList)
            } catch (err) {
              setError('Ошибка подключения кошелька')
              throw err
            } finally {
              setIsLoading(false)
            }
          },
          disconnect: async () => {
            try {
              await tonConnection.disconnect()
            } catch (err) {
              setError('Ошибка отключения кошелька')
              throw err
            }
          },
          sendTransaction: async (transaction: any) => {
            setIsLoading(true)
            setError(null)
            try {
              const result = await tonConnection.sendTransaction(transaction)
              return result
            } catch (err) {
              setError('Ошибка отправки транзакции')
              throw err
            } finally {
              setIsLoading(false)
            }
          },
          isConnected: tonConnection.connected,
          address: tonConnection.wallet?.account?.address,
        })

        // Подписка на изменения статуса подключения
        tonConnection.onStatusChange((wallet: any) => {
          setConnection(prev => prev ? {
            ...prev,
            isConnected: !!wallet,
            address: wallet?.account?.address
          } : null)
        })

      } catch (err) {
        console.error('TON Connect initialization error:', err)
        setError('Ошибка инициализации TON Connect')
      }
    }

    initTonConnect()
  }, [])

  const connectWallet = useCallback(async () => {
    if (!connection) return
    await connection.connect()
  }, [connection])

  const disconnectWallet = useCallback(async () => {
    if (!connection) return
    await connection.disconnect()
  }, [connection])

  const sendTransaction = useCallback(async (transaction: PaymentTransaction) => {
    if (!connection) throw new Error('TON Connect не инициализирован')
    return await connection.sendTransaction(transaction)
  }, [connection])

  return {
    connection,
    isConnected: connection?.isConnected || false,
    address: connection?.address,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
    sendTransaction,
  }
}