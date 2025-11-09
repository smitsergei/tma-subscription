'use client'

import { useState, useEffect, useCallback } from 'react'
import { PaymentTransaction } from '@/types'

export function useTonConnect() {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tonConnect, setTonConnect] = useState<any>(null)

  useEffect(() => {
    // Инициализация TON Connect только в браузере
    if (typeof window === 'undefined') return

    const initTonConnect = async () => {
      try {
        console.log('🔗 Initializing TON Connect...')

        // Динамический импорт TON Connect SDK
        const { TonConnect } = await import('@tonconnect/sdk')

        const manifestUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tonconnect-manifest.json`
        console.log('📋 Manifest URL:', manifestUrl)

        const tonConnection = new TonConnect({
          manifestUrl,
        })

        setTonConnect(tonConnection)

        // Проверяем текущий статус подключения
        if (tonConnection.connected && tonConnection.wallet) {
          setIsConnected(true)
          setAddress(tonConnection.wallet.account.address)
          console.log('✅ Wallet already connected:', tonConnection.wallet.account.address)
        }

        // Подписка на изменения статуса подключения
        tonConnection.onStatusChange((wallet: any) => {
          console.log('🔄 Wallet status changed:', wallet)
          setIsConnected(!!wallet)
          setAddress(wallet?.account?.address || null)
          if (wallet) {
            console.log('✅ Wallet connected:', wallet.account.address)
          } else {
            console.log('❌ Wallet disconnected')
          }
        })

        console.log('✅ TON Connect initialized successfully')

      } catch (err) {
        console.error('❌ TON Connect initialization error:', err)
        setError('Ошибка инициализации TON Connect')
      }
    }

    initTonConnect()
  }, [])

  const connectWallet = useCallback(async () => {
    if (!tonConnect) {
      console.error('❌ TON Connect not initialized')
      setError('TON Connect не инициализирован')
      return
    }

    console.log('🔗 Connecting wallet...')
    setIsLoading(true)
    setError(null)

    try {
      const walletsList = await tonConnect.getWallets()
      console.log('📱 Available wallets:', walletsList)

      // Показываем модальное окно выбора кошелька
      await tonConnect.connect(walletsList)
      console.log('✅ Wallet connection initiated')
    } catch (err) {
      console.error('❌ Wallet connection error:', err)
      setError('Ошибка подключения кошелька')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [tonConnect])

  const disconnectWallet = useCallback(async () => {
    if (!tonConnect) return

    try {
      await tonConnect.disconnect()
      console.log('✅ Wallet disconnected')
    } catch (err) {
      console.error('❌ Wallet disconnection error:', err)
      setError('Ошибка отключения кошелька')
      throw err
    }
  }, [tonConnect])

  const sendTransaction = useCallback(async (transaction: PaymentTransaction) => {
    if (!tonConnect) {
      throw new Error('TON Connect не инициализирован')
    }

    console.log('💳 Sending transaction:', transaction)
    setIsLoading(true)
    setError(null)

    try {
      const result = await tonConnect.sendTransaction(transaction)
      console.log('✅ Transaction sent successfully:', result)
      return result
    } catch (err) {
      console.error('❌ Transaction error:', err)
      setError('Ошибка отправки транзакции')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [tonConnect])

  return {
    isConnected,
    address,
    isLoading,
    error,
    connectWallet,
    disconnectWallet,
    sendTransaction,
  }
}