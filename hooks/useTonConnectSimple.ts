'use client'

import { useState, useEffect, useCallback } from 'react'
import { PaymentTransaction } from '@/types'

export function useTonConnectSimple() {
  const [isConnected, setIsConnected] = useState(false)
  const [address, setAddress] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tonConnect, setTonConnect] = useState<any>(null)

  useEffect(() => {
    // Инициализация только в браузере
    if (typeof window === 'undefined') return

    const initTonConnect = async () => {
      try {
        console.log('🔗 Initializing TON Connect (Simple)...')

        // Динамический импорт
        const { TonConnect } = await import('@tonconnect/sdk')

        const manifestUrl = `${process.env.NEXT_PUBLIC_APP_URL}/tonconnect-manifest.json`
        console.log('📋 Manifest URL:', manifestUrl)

        // Проверяем доступность manifest
        try {
          const manifestResponse = await fetch(manifestUrl)
          if (!manifestResponse.ok) {
            throw new Error(`Manifest not available: ${manifestResponse.status}`)
          }
          const manifest = await manifestResponse.json()
          console.log('✅ Manifest loaded:', manifest)
        } catch (manifestErr) {
          console.error('❌ Manifest error:', manifestErr)
          setError('Не удалось загрузить конфигурацию TON Connect')
          return
        }

        const tonConnection = new TonConnect({
          manifestUrl,
        })

        setTonConnect(tonConnection)

        // Проверяем текущий статус
        if (tonConnection.connected && tonConnection.wallet) {
          setIsConnected(true)
          setAddress(tonConnection.wallet.account.address)
          console.log('✅ Wallet already connected:', tonConnection.wallet.account.address)
        }

        // Подписка на изменения
        tonConnection.onStatusChange((wallet: any) => {
          console.log('🔄 Wallet status changed:', wallet)
          setIsConnected(!!wallet)
          setAddress(wallet?.account?.address || null)

          if (wallet) {
            console.log('✅ Wallet connected:', wallet.account.address)
            // Уведомление для Telegram
            if (window.Telegram?.WebApp) {
              window.Telegram.WebApp.HapticFeedback.notificationOccurred('success')
            }
          } else {
            console.log('❌ Wallet disconnected')
          }
        })

        console.log('✅ TON Connect initialized successfully')

      } catch (err) {
        console.error('❌ TON Connect initialization error:', err)
        setError('Ошибка инициализации TON Connect: ' + (err as Error).message)
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
      // Для Telegram Mini App используем специальный подход
      if (window.Telegram?.WebApp) {
        console.log('📱 Running in Telegram Web App')

        // Показываем загрузку
        window.Telegram.WebApp.showPopup({
          title: 'Подключение кошелька',
          message: 'Выберите кошелек для подключения платежей',
          buttons: [
            { id: 'connect', type: 'default', text: 'Продолжить' },
            { id: 'cancel', type: 'cancel', text: 'Отмена' }
          ]
        }, (buttonId: string) => {
          if (buttonId === 'connect') {
            proceedWithConnection()
          } else {
            setIsLoading(false)
          }
        })
      } else {
        // Для обычного браузера
        await proceedWithConnection()
      }
    } catch (err) {
      console.error('❌ Wallet connection error:', err)
      setError('Ошибка подключения кошелька: ' + (err as Error).message)
      setIsLoading(false)
      throw err
    }
  }, [tonConnect])

  const proceedWithConnection = async () => {
    try {
      const walletsList = await tonConnect.getWallets()
      console.log('📱 Available wallets:', walletsList)

      if (walletsList.length === 0) {
        throw new Error('Нет доступных кошельков')
      }

      // Показываем модальное окно выбора кошелька
      await tonConnect.connect(walletsList)
      console.log('✅ Wallet connection initiated')
    } catch (err) {
      console.error('❌ Proceed connection error:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const disconnectWallet = useCallback(async () => {
    if (!tonConnect) return

    try {
      await tonConnect.disconnect()
      console.log('✅ Wallet disconnected')

      // Уведомление для Telegram
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('warning')
      }
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

  // Глобальная функция для отладки
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).tonConnectDebug = {
        isConnected,
        address,
        tonConnect,
        connectWallet,
        disconnectWallet
      }
      console.log('🔧 TON Connect debug available at window.tonConnectDebug')
    }
  }, [isConnected, address, tonConnect, connectWallet, disconnectWallet])

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