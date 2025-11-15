# Архитектура системы

## 🏗️ Технологический стек

### 🚀 Frontend
- **Next.js 14** - React-фреймворк нового поколения с App Router
- **TypeScript** - Типобезопасная разработка
- **Tailwind CSS** - Utility-first CSS фреймворк
- **React Hook Form** - Управление формами с валидацией
- **Zustand** - Легковесное управление состоянием

### ⚙️ Backend
- **Vercel Serverless Functions** - Бессерверные функции
- **Node.js** - Среда выполнения JavaScript
- **Prisma ORM** - Современный ORM для баз данных
- **Vercel Postgres** - Управляемая PostgreSQL база данных
- **Vercel KV (Redis)** - Кэширование и временные данные

### 💳 Платежи
- **NOWPayments API** - Основной платежный шлюз (50+ криптовалют и фиат)
- **Банковские карты** - Прямые фиатные платежи
- **Криптовалюты** - BTC, ETH, LTC, USDT, USDC и другие
- **Вебхуки** - Мгновенные уведомления о платежах

### 🤖 Telegram интеграция
- **Telegram Bot API** - Управление ботами и каналами
- **Telegram WebApp** - Mini Apps внутри Telegram
- **Webhook обработка** - Реакция на события Telegram

## 🏛️ Системная архитектура

```mermaid
graph TB
    subgraph "Клиентская сторона"
        A[Telegram Mini App] --> B[React Components]
        C[Admin Panel] --> B
        B --> D[NOWPayments Button]
    end

    subgraph "Vercel Infrastructure"
        E[API Routes] --> F[Serverless Functions]
        G[Cron Jobs] --> F
        H[Static Assets] --> I[Vercel CDN]
    end

    subgraph "Внешние сервисы"
        J[NOWPayments API]
        K[Telegram Bot API]
        L[Payment Gateways]
        M[PostgreSQL Database]
        N[Redis Cache]
    end

    A --> E
    C --> E
    F --> J
    F --> K
    F --> L
    F --> M
    F --> N
```

## 📁 Структура проекта

```
tma-subscription/
├── 📁 app/                          # Next.js App Router
│   ├── 📁 api/                      # API эндпоинты
│   │   ├── 📁 admin/                # Админские функции
│   │   │   ├── auth/route.ts        # Авторизация админа
│   │   │   ├── stats/route.ts       # Статистика системы
│   │   │   ├── products/            # Управление продуктами
│   │   │   ├── channels/            # Управление каналами
│   │   │   ├── subscriptions/       # Управление подписками
│   │   │   ├── users/               # Управление пользователями
│   │   │   ├── discounts/           # Скидки
│   │   │   ├── promocodes/          # Промокоды
│   │   │   ├── broadcasts/          # Рассылки
│   │   │   └── demo/                # Демо-доступ
│   │   ├── 📁 payment/              # Платежная система
│   │   │   ├── initiate/route.ts    # Инициация платежа
│   │   │   ├── monitor/route.ts     # Мониторинг транзакций
│   │   │   ├── verify/route.ts      # Верификация платежей
│   │   │   ├── verify-usdt/route.ts # Верификация USDT
│   │   │   ├── details/route.ts     # Детали платежа
│   │   │   └── webhook/route.ts     # Webhook обработки
│   │   ├── 📁 user/                 # Пользовательские API
│   │   │   ├── subscriptions/route.ts
│   │   │   ├── payments/route.ts
│   │   │   └── profile/route.ts
│   │   ├── 📁 cron/                 # Фоновые задачи
│   │   │   ├── check-subscriptions/route.ts
│   │   │   ├── check-demo-access/route.ts
│   │   │   └── scheduled-broadcasts/route.ts
│   │   └── 📁 webhook/              # Вебхуки
│   │       └── telegram/route.ts    # Telegram webhook
│   ├── 📁 app/                      # Telegram Mini App
│   │   ├── page.tsx                 # Главная страница TMA
│   │   └── layout.tsx               # Layout для TMA
│   ├── 📁 admin/                    # Админ-панель
│   │   ├── page.tsx                 # Главная админ-панель
│   │   └── old-page.tsx             # Старая версия
│   ├── 📁 payments/                 # Страницы платежей
│   ├── 📁 terms/                    # Условия использования
│   ├── 📁 privacy/                  # Политика конфиденциальности
│   └── 📁 page.tsx                  # Главная страница
├── 📁 components/                   # React компоненты
│   ├── 📁 admin/                    # Компоненты админки
│   │   ├── AdminDashboard.tsx       # Дашборд
│   │   ├── StatsCard.tsx            # Карточки статистики
│   │   ├── ProductManagement.tsx    # Управление продуктами
│   │   ├── UserManagement.tsx       # Управление пользователями
│   │   ├── SubscriptionManagement.tsx # Подписки
│   │   ├── BroadcastManagement.tsx  # Рассылки
│   │   └── ...
│   ├── TonConnectButton.tsx         # Кнопка TON Connect
│   ├── ProductList.tsx              # Список продуктов
│   ├── UserSubscriptions.tsx        # Подписки пользователя
│   └── LoadingSpinner.tsx           # Индикатор загрузки
├── 📁 lib/                          # Утилиты и конфигурации
│   ├── 📁 telegram/                 # Telegram API интеграция
│   ├── 📁 ton/                      # TON Connect интеграция
│   ├── 📁 payments/                 # Платежная система
│   ├── 📁 db/                       # База данных
│   └── 📁 utils/                    # Общие утилиты
├── 📁 types/                        # TypeScript типы
│   ├── telegram.ts                  # Telegram типы
│   ├── ton.ts                       # TON типы
│   ├── payment.ts                   # Платежные типы
│   └── database.ts                  # Типы БД
├── 📁 prisma/                       # Prisma ORM
│   ├── schema.prisma                # Схема базы данных
│   ├── migrations/                  # Миграции
│   └── seed.ts                      # Начальные данные
├── 📁 public/                       # Статические файлы
├── 📄 package.json                  # Зависимости
├── 📄 next.config.js                # Next.js конфигурация
├── 📄 tailwind.config.js            # Tailwind конфигурация
└── 📄 tsconfig.json                 # TypeScript конфигурация
```

## 🗄️ Архитектура базы данных

### 💾 Основные модели

```sql
-- Пользователи системы
CREATE TABLE users (
  telegram_id BIGINT PRIMARY KEY,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  language_code VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Администраторы
CREATE TABLE admins (
  telegram_id BIGINT PRIMARY KEY,
  role VARCHAR(50) DEFAULT 'admin',
  permissions TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Telegram каналы
CREATE TABLE channels (
  id SERIAL PRIMARY KEY,
  channel_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  title VARCHAR(255),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Продукты/планы подписок
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  channel_id BIGINT REFERENCES channels(channel_id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USDT',
  period_days INTEGER NOT NULL,
  discount_price DECIMAL(10,2),
  is_trial BOOLEAN DEFAULT false,
  trial_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Платежи
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  payment_id VARCHAR(255) UNIQUE NOT NULL,
  user_id BIGINT REFERENCES users(telegram_id),
  product_id INTEGER REFERENCES products(id),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USDT',
  status VARCHAR(50) DEFAULT 'pending',
  tx_hash VARCHAR(255),
  memo VARCHAR(255),
  payment_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP
);

-- Подписки
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  subscription_id VARCHAR(255) UNIQUE NOT NULL,
  user_id BIGINT REFERENCES users(telegram_id),
  product_id INTEGER REFERENCES products(id),
  channel_id BIGINT REFERENCES channels(channel_id),
  payment_id VARCHAR(255) REFERENCES payments(payment_id),
  status VARCHAR(50) DEFAULT 'active',
  starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Скидки
CREATE TABLE discounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'percentage' or 'fixed'
  value DECIMAL(10,2) NOT NULL,
  min_product_id INTEGER REFERENCES products(id),
  max_discounts INTEGER,
  used_count INTEGER DEFAULT 0,
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Промокоды
CREATE TABLE promocodes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  discount_id INTEGER REFERENCES discounts(id),
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  user_restriction VARCHAR(50), -- 'new', 'existing', 'all'
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Рассылки
CREATE TABLE broadcasts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  message TEXT NOT NULL,
  send_type VARCHAR(50) DEFAULT 'immediate', -- 'immediate' or 'scheduled'
  scheduled_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'draft',
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP
);

-- Фильтры рассылок
CREATE TABLE broadcast_filters (
  id SERIAL PRIMARY KEY,
  broadcast_id INTEGER REFERENCES broadcasts(id),
  filter_type VARCHAR(50), -- 'subscription', 'payment', 'demo', etc.
  filter_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔄 Потоки данных

### 🚀 Процесс покупки подписки

```mermaid
sequenceDiagram
    participant U as User
    participant T as Telegram Mini App
    participant A as API
    participant DB as Database
    participant TC as TON Connect
    participant BC as Blockchain

    U->>T: Выбирает продукт
    T->>A: Запуск платежа (/api/payment/initiate)
    A->>DB: Создание записи о платеже
    A->>A: Генерация уникального memo
    A->>T: Возврат данных для транзакции
    T->>TC: Подключение кошелька
    TC->>U: Подтверждение транзакции
    TC->>BC: Отправка транзакции
    BC->>A: Webhook о транзакции
    A->>A: Верификация через Toncenter
    A->>DB: Обновление статуса платежа
    A->>DB: Создание подписки
    A->>T: Уведомление об успехе
    A->>T: Добавление в Telegram канал
```

### 🤖 Авторизация администратора

```mermaid
sequenceDiagram
    participant A as Admin
    participant W as WebApp
    participant API as Admin API
    participant DB as Database

    A->>W: Открытие админ-панели
    W->>API: Отправка Telegram WebApp data
    API->>API: Валидация HMAC подписи
    API->>API: Проверка telegram_id
    API->>DB: Поиск в таблице admins
    DB->>API: Информация об админе
    API->>W: JWT токен + данные админа
    W->>A: Отображение дашборда
```

### ⚡ Проверка подписок (Cron Job)

```mermaid
sequenceDiagram
    participant C as Cron Scheduler
    participant API as API /api/cron/check-subscriptions
    participant DB as Database
    participant TB as Telegram Bot API

    C->>API: Запуск каждые 6 часов
    API->>DB: Поиск истекших подписок
    DB->>API: Список подписок
    loop Для каждой подписки
        API->>DB: Обновление статуса на 'expired'
        API->>TB: Удаление пользователя из канала
        API->>TB: Отправка уведомления пользователю
    end
    API->>C: Завершение задачи
```

## 🔒 Безопасность

### 🛡️ Механизмы защиты

#### 🔐 Валидация Telegram WebApp
```typescript
// Проверка initData от Telegram
function validateTelegramWebApp(initData: string, botToken: string): boolean {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');

  // Проверка HMAC подписи
  const dataCheckString = createDataCheckString(urlParams);
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return hash === expectedHash;
}
```

#### 💰 Защита платежей
- **Уникальные memo** для каждой транзакции
- **Проверка суммы** и получателя
- **Верификация через Toncenter API**
- **Защита от двойных платежей**
- **Таймауты для транзакций**

#### 🚫 Анти-фрод
- **Rate limiting** для API запросов
- **Проверка User-Agent** и IP адресов
- **Мониторинг подозрительной активности**
- **Блокировка по множественным попыткам**

### 🔐 Переменные окружения

```bash
# Telegram Bot Configuration
BOT_TOKEN=your_telegram_bot_token
BOT_SECRET=your_bot_webhook_secret

# Database Configuration
POSTGRES_URL=postgresql://user:password@host:port/database
POSTGRES_PRISMA_URL=postgresql://user:password@host:port/database?pgbouncer=true

# TON Configuration
TONCENTER_API_KEY=your_toncenter_api_key
TON_WALLET_ADDRESS=your_usdt_wallet_address

# Security
NEXTAUTH_SECRET=your_nextauth_secret
JWT_SECRET=your_jwt_secret

# Admin Configuration
ADMIN_TELEGRAM_ID=your_admin_telegram_id

# Application Configuration
APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# NOWPayments (optional)
NOWPAYMENTS_API_KEY=your_nowpayments_api_key
NOWPAYMENTS_IPN_SECRET=your_ipn_secret

# Monitoring
VERCEL_ANALYTICS_ID=your_analytics_id
SENTRY_DSN=your_sentry_dsn
```

## ⚡ Производительность

### 🚀 Оптимизации

#### 📦 Frontend оптимизации
- **Code splitting** по роутам
- **Lazy loading** для компонентов
- **Image optimization** через Next.js
- **Font optimization** и preloading
- **Service Workers** для кэширования

#### ⚙️ Backend оптимизации
- **Serverless функции** с правильным timeout
- **Database connection pooling**
- **Redis кэширование** для частых запросов
- **CDN раздача** статических файлов
- **API response caching**

#### 🗄️ Оптимизации базы данных
- **Proper indexing** для быстрых запросов
- **Connection pooling** через Prisma
- **Query optimization** и N+1 problem prevention
- **Regular maintenance** и VACUUM

### 📊 Мониторинг

#### 🔍 Метрики производительности
- **Response time** для API эндпоинтов
- **Database query time**
- **Vercel function cold starts**
- **Error rates** и типы ошибок
- **User engagement** метрики

#### 📈 Инструменты мониторинга
- **Vercel Analytics** для производительности
- **Vercel Logs** для ошибок
- **Prisma Studio** для БД
- **Sentry** для error tracking
- **Custom dashboards** для бизнес-метрик

---

## 🎯 Ключевые преимущества архитектуры

✅ **Масштабируемость** — Serverless архитектура растет с аудиторией
✅ **Надежность** — Vercel гарантирует 99.9% uptime
✅ **Безопасность** — Многоуровневая защита на всех уровнях
✅ **Производительность** — Оптимизированы для глобальной аудитории
✅ **Гибкость** — Легко расширять и интегрировать

[📋 Установка и настройка](./installation.md) | [🔧 Конфигурация](./configuration.md)