# Конфигурация системы

## ⚙️ Детальная настройка после установки

После развертывания системы необходимо выполнить тонкую настройку для оптимальной работы.

---

## 🤖 Конфигурация Telegram бота

### 📝 Настройка команд бота

```bash
# Установка расширенного списка команд
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command": "start", "description": "🚀 Начать работу"},
      {"command": "subscriptions", "description": "📱 Мои подписки"},
      {"command": "products", "description": "🛍️ Доступные продукты"},
      {"command": "balance", "description": "💰 Мой баланс"},
      {"command": "support", "description": "🆘 Поддержка"},
      {"command": "help", "description": "❓ Помощь"}
    ]
  }'
```

### 🎨 Настройка описания бота

```bash
# Установка описания бота
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setDescription" \
  -d "description=🚀 Платформа для подписок на эксклюзивный контент. Оплачивайте доступ через TON Connect и получайте мгновенный доступ к закрытым каналам."
```

### 🖼️ Настройка Mini App

Создайте файл `public/manifest.json`:

```json
{
  "name": "TMA Подписка",
  "short_name": "Подписка",
  "description": "Платформа для управления подписками на Telegram-каналы",
  "start_url": "/app",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#0088cc",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## 💳 Конфигурация платежной системы

### 🚀 TON Connect настройка

#### 📋 Требования к кошельку
```typescript
// lib/ton/config.ts
export const TON_CONFIG = {
  // Адрес вашего USDT кошелька
  walletAddress: process.env.TON_WALLET_ADDRESS!,

  // Сеть: TESTNET или MAINNET
  network: process.env.NODE_ENV === 'development' ? 'TESTNET' : 'MAINNET',

  // Минимальная сумма платежа
  minPayment: '1', // 1 USDT

  // Максимальная сумма платежа
  maxPayment: '10000', // 10000 USDT

  // Время ожидания транзакции (в минутах)
  transactionTimeout: 30,

  // USDT контракт адрес (для MAINNET)
  usdtContractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',

  // USDT контракт адрес (для TESTNET)
  testnetUsdtContractAddress: 'EQB2cq_n7iOTlW1wqjD6kz3r6hF5iXaJ9m6Gz1Y2X3Z4A5B6C'
};
```

#### ⚙️ Настройка Toncenter API

```typescript
// lib/ton/toncenter.ts
export const TONCENTER_CONFIG = {
  apiKey: process.env.TONCENTER_API_KEY!,

  // Базовый URL API
  baseUrl: process.env.NODE_ENV === 'development'
    ? 'https://testnet.toncenter.com/api/v3'
    : 'https://toncenter.com/api/v3',

  // Лимиты запросов
  rateLimit: {
    requestsPerSecond: 1,
    requestsPerMinute: 60
  },

  // Таймауты
  timeout: 30000, // 30 секунд

  // Количество попыток при ошибке
  retryAttempts: 3,

  // Задержка между попытками
  retryDelay: 1000 // 1 секунда
};
```

### 💰 NOWPayments настройка (опционально)

```typescript
// lib/payments/nowpayments.ts
export const NOWPAYMENTS_CONFIG = {
  apiKey: process.env.NOWPAYMENTS_API_KEY!,

  // IPN секрет для вебхуков
  ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET!,

  // Базовый URL API
  baseUrl: 'https://api.nowpayments.io/v1',

  // Поддерживаемые криптовалюты
  supportedCurrencies: ['BTC', 'ETH', 'LTC', 'USDT', 'USDC'],

  // Минимальные суммы по валютам
  minAmounts: {
    'BTC': 0.0001,
    'ETH': 0.01,
    'LTC': 0.01,
    'USDT': 10,
    'USDC': 10
  },

  // Время жизни платежа (в минутах)
  paymentLifetime: 60,

  // Комиссия сервиса
  serviceFee: 0.005 // 0.5%
};
```

---

## 🗄️ Конфигурация базы данных

### 🔧 Оптимизация Prisma

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_URL")
}

// Оптимизация соединений
// В vercel.json:
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  }
}
```

### 📊 Настройка индексов производительности

```sql
-- Индексы для быстрых запросов подписок
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);

-- Индексы для платежей
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_payments_tx_hash ON payments(tx_hash);

-- Индексы для продуктов
CREATE INDEX idx_products_channel_id ON products(channel_id);
CREATE INDEX idx_products_is_active ON products(is_active);

-- Индексы для пользователей
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_username ON users(username);

-- Составные индексы для сложных запросов
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX idx_payments_user_status ON payments(user_id, status);
```

### 🔄 Настройка пулирования соединений

```typescript
// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.POSTGRES_URL,
      },
    },
    // Оптимизация для serverless
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Настройки connection pool
    __internal: {
      engine: {
        connectionLimit: 10,
        poolTimeout: 10000,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

---

## 📧 Настройка уведомлений

### 🤖 Telegram уведомления

```typescript
// lib/notifications/telegram.ts
export const TELEGRAM_NOTIFICATIONS = {
  // Шаблоны сообщений
  templates: {
    welcome: `🎉 Добро пожаловать!\n\nСпасибо за подписку на {product_name}.\nДоступ до: {expiry_date}`,
    paymentReceived: `✅ Платеж получен!\n\nСумма: {amount} {currency}\nПродукт: {product_name}`,
    subscriptionExpiring: `⏰ Подписка истекает!\n\nВаша подписка на {product_name} истекает через {days_left} дней.\nПродлите доступ: {renewal_link}`,
    subscriptionExpired: `🔒 Подписка истекла!\n\nДоступ к {product_name} прекращен.\nПродлите подписку: {renewal_link}`,
    paymentFailed: `❌ Платеж не прошел!\n\nПопробуйте снова или свяжитесь с поддержкой.`,
    newPurchase: `🎊 Новая покупка!\n\nПользователь: @{username}\nПродукт: {product_name}\nСумма: {amount} {currency}`
  },

  // Настройки отправки
  settings: {
    rateLimit: {
      messagesPerSecond: 30,
      messagesPerMinute: 1000
    },

    retryAttempts: 3,
    retryDelay: 1000,

    // Время жизни сообщения (в секундах)
    messageTTL: 86400, // 24 часа

    // Разрешить разметку
    allowMarkdown: true,
    allowHTML: false
  }
};
```

### 📧 Email уведомления (опционально)

```typescript
// lib/notifications/email.ts
export const EMAIL_NOTIFICATIONS = {
  provider: 'resend', // или 'sendgrid', 'aws-ses'

  apiKey: process.env.EMAIL_SERVICE_API_KEY!,

  fromEmail: 'noreply@yourdomain.com',
  fromName: 'TMA Подписка',

  templates: {
    welcome: {
      subject: 'Добро пожаловать в систему подписок!',
      template: 'welcome-email.html'
    },
    paymentReceived: {
      subject: 'Подтверждение платежа',
      template: 'payment-confirmation.html'
    },
    subscriptionExpiring: {
      subject: 'Ваша подписка скоро истечет',
      template: 'subscription-expiring.html'
    }
  },

  settings: {
    rateLimit: {
      emailsPerMinute: 100
    },

    retryAttempts: 3,
    retryDelay: 5000
  }
};
```

---

## 🔒 Конфигурация безопасности

### 🛡️ Rate Limiting

```typescript
// lib/security/rateLimit.ts
export const RATE_LIMIT_CONFIG = {
  // API эндпоинты
  '/api/payment/initiate': {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // максимум 5 запросов
    message: 'Слишком много попыток оплаты. Попробуйте позже.'
  },

  '/api/admin/*': {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // максимум 100 запросов
    message: 'Слишком много запросов к админ-панели.'
  },

  '/api/auth/*': {
    windowMs: 60 * 60 * 1000, // 1 час
    max: 10, // максимум 10 попыток входа
    message: 'Слишком много попыток входа. Попробуйте позже.'
  },

  // Глобальные настройки
  global: {
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 1000, // максимум 1000 запросов с IP
    message: 'Слишком много запросов. Попробуйте позже.'
  }
};
```

### 🔐 CORS и CSP настройки

```typescript
// next.config.js
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' ? '*' : 'https://t.me',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "connect-src 'self' https://toncenter.com https://api.nowpayments.io"
            ].join('; '),
          },
        ],
      },
    ];
  },
};
```

---

## 📊 Конфигурация аналитики

### 📈 Vercel Analytics

```typescript
// lib/analytics/vercel.ts
import { getAnalytics } from '@vercel/analytics/server';

export const analyticsConfig = {
  // Отслеживание ключевых событий
  events: {
    payment_initiated: 'payment_initiated',
    payment_completed: 'payment_completed',
    payment_failed: 'payment_failed',
    subscription_created: 'subscription_created',
    subscription_expired: 'subscription_expired',
    user_registered: 'user_registered',
    product_viewed: 'product_viewed'
  },

  // Настройки приватности
  privacy: {
    maskIP: true,
    maskUserAgent: true,
    respectDoNotTrack: true
  }
};
```

### 📊 Кастомная аналитика

```typescript
// lib/analytics/custom.ts
export const customAnalytics = {
  // Метрики для отслеживания
  metrics: {
    dailyRevenue: 'daily_revenue',
    activeSubscriptions: 'active_subscriptions',
    conversionRate: 'conversion_rate',
    averageOrderValue: 'average_order_value',
    churnRate: 'churn_rate',
    userLifetimeValue: 'user_lifetime_value'
  },

  // Дашборды
  dashboards: {
    overview: 'Общая статистика',
    revenue: 'Доходы',
    users: 'Пользователи',
    products: 'Продукты',
    performance: 'Производительность'
  },

  // Агрегация данных
  aggregation: {
    intervals: ['hour', 'day', 'week', 'month'],
    retention: 30 // дней
  }
};
```

---

## 🎨 Конфигурация UI/UX

### 🎨 Темы и брендинг

```typescript
// lib/ui/theme.ts
export const themeConfig = {
  // Основные цвета
  colors: {
    primary: '#0088cc',
    secondary: '#1a1a1a',
    accent: '#00a86b',
    error: '#dc3545',
    warning: '#ffc107',
    success: '#28a745',

    // Цвета для Telegram
    telegramBlue: '#0088cc',
    telegramDark: '#1a1a1a',
    telegramLight: '#f8f9fa'
  },

  // Типографика
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace']
    },
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }]
    }
  },

  // Адаптивность
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px'
  }
};
```

### 🌍 Мультиязычность

```typescript
// lib/i18n/config.ts
export const i18nConfig = {
  // Поддерживаемые языки
  locales: ['ru', 'en', 'es', 'de', 'fr'],

  // Язык по умолчанию
  defaultLocale: 'ru',

  // Определение языка пользователя
  localeDetection: [
    'url', // из URL /en/page
    'cookie', // из cookie
    'header', // из Accept-Language header
    'userProfile' // из профиля пользователя
  ],

  // Переводы для интерфейса
  translations: {
    ru: {
      'common.subscribe': 'Подписаться',
      'common.price': 'Цена',
      'common.duration': 'Длительность',
      'payment.processing': 'Обработка платежа...',
      'payment.success': 'Платеж успешный!',
      'payment.failed': 'Платеж не прошел'
    },
    en: {
      'common.subscribe': 'Subscribe',
      'common.price': 'Price',
      'common.duration': 'Duration',
      'payment.processing': 'Processing payment...',
      'payment.success': 'Payment successful!',
      'payment.failed': 'Payment failed'
    }
    // ... другие языки
  }
};
```

---

## 🚀 Конфигурация производительности

### ⚡ Кэширование

```typescript
// lib/cache/config.ts
export const cacheConfig = {
  // Redis кэш
  redis: {
    ttl: {
      user: 3600, // 1 час
      products: 1800, // 30 минут
      payments: 300, // 5 минут
      subscriptions: 600 // 10 минут
    },

    // Ключи кэша
    keys: {
      user: (telegramId: number) => `user:${telegramId}`,
      products: () => 'products:all',
      activePayments: (userId: number) => `payments:active:${userId}`,
      userSubscriptions: (userId: number) => `subscriptions:${userId}`
    }
  },

  // HTTP кэш
  http: {
    // Статические файлы
    static: {
      maxAge: 31536000, // 1 год
      immutable: true
    },

    // API ответы
    api: {
      products: 'public, max-age=300', // 5 минут
      userProfile: 'private, max-age=60', // 1 минута
      stats: 'private, max-age=300' // 5 минут
    }
  }
};
```

### 📦 Оптимизация сборки

```javascript
// next.config.js
const nextConfig = {
  // Оптимизация изображений
  images: {
    domains: ['your-domain.com'],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  },

  // Оптимизация шрифтов
  optimizeFonts: true,

  // Компрессия
  compress: true,

  // SWC минификация
  swcMinify: true,

  // Перезапись URL для API
  async rewrites() {
    return [
      {
        source: '/api/health',
        destination: '/api/health',
      },
    ];
  },

  // Переменные окружения для клиента
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_TON_NETWORK: process.env.NODE_ENV === 'development' ? 'TESTNET' : 'MAINNET'
  }
};
```

---

## 📱 Конфигурация мобильной версии

### 📲 PWA настройки

```json
// public/manifest.json
{
  "name": "TMA Подписка",
  "short_name": "Подписка",
  "description": "Управление подписками на Telegram каналы",
  "start_url": "/app?utm_source=pwa",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#0088cc",
  "orientation": "portrait",
  "scope": "/",
  "categories": ["finance", "productivity"],
  "lang": "ru",
  "icons": [
    {
      "src": "/icon-72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icon-96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icon-128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icon-144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icon-152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "shortcuts": [
    {
      "name": "Мои подписки",
      "short_name": "Подписки",
      "description": "Просмотр активных подписок",
      "url": "/app/subscriptions",
      "icons": [
        {
          "src": "/icon-96.png",
          "sizes": "96x96"
        }
      ]
    }
  ]
}
```

---

## 🎯 Чек-лист конфигурации

### ✅ Обязательные настройки

- [ ] **Переменные окружения** заполнены и проверены
- [ ] **Telegram бот** настроен с командами и описанием
- [ ] **TON кошелек** подключен и протестирован
- [ ] **База данных** оптимизирована с индексами
- [ ] **Cron jobs** настроены и работают
- [ ] **Администратор** добавлен в систему
- [ ] **Безопасность** настроена (rate limiting, CORS)

### 🔧 Рекомендуемые настройки

- [ ] **Аналитика** подключена и настроена
- [ ] **Email уведомления** настроены (если нужно)
- [ ] **Кэширование** оптимизировано
- [ ] **PWA** функционал настроен
- [ ] **Мультиязычность** добавлена (если нужно)
- [ ] **Мониторинг** ошибок настроен
- [ ] **Бэкапы** базы данных настроены

### 🚀 Оптимизации производительности

- [ ] **Изображения** оптимизированы и в WebP
- [ ] **Шрифты** оптимизированы и preloaded
- [ ] **API** закэшированы где возможно
- [ ] **CDN** настроен для статических файлов
- [ ] **Lazy loading** для изображений и компонентов
- [ ] **Code splitting** настроен правильно

---

## 🆘 Поиск проблем

### 🔧 Частые проблемы конфигурации

#### Ошибка: "TON Connect не работает"
**Решение**: Проверьте TON_WALLET_ADDRESS и TONCENTER_API_KEY

#### Ошибка: "База данных медленная"
**Решение**: Добавьте недостающие индексы и проверьте connection pool

#### Ошибка: "Cron jobs не выполняются"
**Решение**: Проверьте URL и расписание в настройках Vercel

#### Ошибка: "UI медленно загружается"
**Решение**: Оптимизируйте изображения и включите кэширование

---

**Готово! 🎉 Система полностью настроена и готова к работе.**

[📡 API справочник](./api-reference.md) | [🗄️ База данных](./database.md)