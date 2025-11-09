// User types
export interface User {
  telegramId: bigint
  username?: string
  firstName?: string
  createdAt: Date
}

export interface Admin extends User {
  telegramId: bigint
}

// Channel types
export interface Channel {
  channelId: bigint
  name: string
  username?: string
  description?: string
  createdAt: Date
}

// Product types
export interface Product {
  productId: string
  channelId: bigint
  name: string
  description?: string
  price: number
  periodDays: number
  discountPrice?: number
  originalDiscountPrice?: number // Постоянная скидка из продукта
  isTrial: boolean
  isActive: boolean
  allowDemo?: boolean
  demoDays?: number
  createdAt: Date
  updatedAt: Date
  channel?: Channel
  activeDiscount?: {
    type: 'PERCENTAGE' | 'FIXED_AMOUNT'
    value: number
    endDate: Date
  }
}

// Payment types
export interface Payment {
  paymentId: string
  userId: bigint
  productId: string
  amount: number
  currency: string
  status: 'pending' | 'success' | 'failed'
  txHash?: string
  memo?: string
  createdAt: Date
  updatedAt: Date
  user?: User
  product?: Product
}

// Subscription types
export interface Subscription {
  subscriptionId: string
  userId: bigint
  productId: string
  channelId: bigint
  paymentId?: string
  status: 'active' | 'expired' | 'revoked'
  startsAt: Date
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
  user?: User
  product?: Product
  channel?: Channel
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Telegram Web App types
export interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    query_id?: string
    user?: TelegramUser
    auth_date?: string
    hash?: string
  }
  ready: () => void
  expand: () => void
  close: () => void
  enableClosingConfirmation: () => void
  setHeaderColor: (color: string) => void
  themeParams: {
    bg_color?: string
    text_color?: string
    button_color?: string
    button_text_color?: string
    secondary_bg_color?: string
    section_separator_color?: string
  }
  onEvent: (eventType: string, callback: () => void) => void
  showAlert?: (message: string) => void
  showConfirm?: (message: string, callback: (confirmed: boolean) => void) => void
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
}

// TON Connect types
export interface TonConnection {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendTransaction: (transaction: any) => Promise<any>
  isConnected: boolean
  address?: string
}

export interface PaymentTransaction {
  address: string
  amount: string // в наноTON
  payload?: string
  stateInit?: string
}

// Form types
export interface ProductFormData {
  channelId: string
  name: string
  description?: string
  price: string
  periodDays: string
  discountPrice?: string
  isTrial: boolean
  isActive: boolean
}

export interface ChannelFormData {
  name: string
  username?: string
  description?: string
}

// Admin stats
export interface AdminStats {
  totalUsers: number
  activeSubscriptions: number
  totalRevenue: number
  totalProducts: number
}

// Global Window interface for Telegram
declare global {
  interface Window {
    Telegram: {
      WebApp: TelegramWebApp
    }
  }
}