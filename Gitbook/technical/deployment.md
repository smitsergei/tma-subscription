# Развертывание и производство

## 🚀 Гайд по продакшн развертыванию

Полное руководство по развертыванию TMA-Подписка в производственной среде с высокой доступностью и масштабируемостью.

---

## 🏗️ Продакшн архитектура

### 🌍 Инфраструктура

```mermaid
graph TB
    subgraph "Global Infrastructure"
        CDN[Vercel Edge Network]
        LB[Load Balancer]
    end

    subgraph "Application Layer"
        API[API Functions]
        APP[Next.js App]
        CRON[Cron Jobs]
    end

    subgraph "Data Layer"
        DB[PostgreSQL Primary]
        REDIS[Redis Cache]
        BACKUP[Backup Storage]
    end

    subgraph "External Services"
        NOWPayments[NOWPayments Network]
        TELEGRAM[Telegram API]
        MONITORING[Monitoring]
    end

    CDN --> LB
    LB --> API
    LB --> APP
    LB --> CRON
    API --> DB
    API --> REDIS
    DB --> BACKUP
    API --> NOWPayments
    API --> TELEGRAM
    MONITORING --> API
    MONITORING --> DB
```

### 🎯 Компоненты продакшн среды

- **Vercel Edge Network** - Глобальная CDN для статических файлов
- **Vercel Functions** - Serverless API с автоскалингом
- **Vercel Postgres** - Управляемая PostgreSQL с репликацией
- **Vercel KV** - Redis для кэширования и сессий
- **Vercel Cron** - Планировщик фоновых задач
- **Telegram Bot API** - Интеграция с Telegram
- **NOWPayments Network** - Блокчейн для платежей

---

## 📋 Подготовка к продакшн

### 🔧 Предварительные требования

#### 💳 Аккаунты и сервисы
- [ ] **Vercel Pro** аккаунт ($20/месяц)
- [ ] **Vercel Postgres** ($0.30/GB-месяц)
- [ ] **Vercel KV** для кэширования
- [ ] **Домен** (рекомендуется для брендинга)
- [ ] **Telegram бот** с настроенными командами
- [ ] **NOWPayments кошелек** для приемов платежей

#### 🔐 Безопасность
- [ ] **SSL сертификаты** (автоматически через Vercel)
- [ ] **Переменные окружения** в Vercel
- [ ] **API ключи** для внешних сервисов
- [ ] **Резервные копии** базы данных
- [ ] **Мониторинг** и алерты

### 🎯 Домен и брендинг

#### 🌐 Настройка домена
```bash
# 1. Добавьте домен в Vercel Dashboard
# 2. Настройте DNS записи:
#    A: @ -> 76.76.19.61
#    A: www -> 76.76.19.61
#    CNAME: _vercel -> cname.vercel-dns.com

# 3. Проверьте настройки через:
dig yourdomain.com
```

#### 🔗 Настройка Telegram Mini App
```typescript
// В @BotFather установите URL Mini App
Mini App URL: https://yourdomain.com/app

// Настройте параметры в Telegram Bot API
curl -X POST "https://api.telegram.org/bot<token>/setChatMenuButton" \
  -d '{
    "chat_menu_button": {
      "type": "web_app",
      "text": "Подписки",
      "web_app": {
        "url": "https://yourdomain.com/app"
      }
    }
  }'
```

---

## ⚙️ Vercel Конфигурация

### 📄 `vercel.json` для продакшн

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30,
      "memory": 1024
    },
    "app/api/admin/**/*.ts": {
      "maxDuration": 60,
      "memory": 1024
    },
    "app/api/payment/**/*.ts": {
      "maxDuration": 60,
      "memory": 512
    }
  },
  "crons": [
    {
      "path": "/api/cron/check-subscriptions",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/check-demo-access",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/scheduled-broadcasts",
      "schedule": "*/5 * * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "https://t.me"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/admin",
      "destination": "/admin/dashboard",
      "permanent": false
    },
    {
      "source": "/bot",
      "destination": "https://t.me/your_bot_username",
      "permanent": false
    }
  ]
}
```

### 🔧 Переменные окружения для продакшн

```bash
# ===========================================
# Production Environment Variables
# ===========================================

# Telegram Configuration
BOT_TOKEN=prod_telegram_bot_token
BOT_SECRET=prod_bot_webhook_secret
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Database (Production)
POSTGRES_URL=postgresql://prod_user:password@host:port/prod_db
POSTGRES_PRISMA_URL=postgresql://prod_user:password@host:port/prod_db?pgbouncer=true
POSTGRES_URL_NON_POOLING=postgresql://prod_user:password@host:port/prod_db

# Redis Cache
KV_URL=redis://redis-endpoint:port
KV_REST_API_URL=https://your-kv-endpoint.vercel.app
KV_REST_API_TOKEN=your_redis_token

# NOWPayments Configuration
NOWPAYMENTS_API_KEY=prod_toncenter_api_key
NOWPAYMENTS_API_KEY=0x1234567890abcdef
NEXT_PUBLIC_PAYMENT_NETWORK=MAINNET

# Security
NEXTAUTH_SECRET=prod_nextauth_secret_min_32_chars
JWT_SECRET=prod_jwt_secret_min_32_chars

# Admin
ADMIN_TELEGRAM_ID=123456789,987654321

# Monitoring
VERCEL_ANALYTICS_ID=prod_analytics_id
SENTRY_DSN=prod_sentry_dsn
SENTRY_AUTH_TOKEN=prod_sentry_token

# Email (optional)
RESEND_API_KEY=prod_resend_api_key
FROM_EMAIL=noreply@yourdomain.com

# NOWPayments (optional)
NOWPAYMENTS_API_KEY=prod_nowpayments_api_key
NOWPAYMENTS_IPN_SECRET=prod_ipn_secret

# Performance
ENABLE_ANALYTICS=true
ENABLE_MONITORING=true
LOG_LEVEL=error
```

---

## 🗄️ Продакшн база данных

### 🏗️ Настройка Vercel Postgres

#### 📊 Создание продакшн БД
```bash
# 1. В Vercel Dashboard → Storage → Create Database
# 2. Выберите PostgreSQL
# 3. Выберите регион (ближайший к вашей аудитории)
# 4. Выберите план (Start: $0/месяц, Pro: $20/месяц)
# 5. Сохраните подключение данные
```

#### 🔧 Оптимизация для продакшн

```sql
-- Создание продакшн индексов
CREATE INDEX CONCURRENTLY idx_subscriptions_user_status_expires
ON subscriptions(user_id, status, expires_at);

CREATE INDEX CONCURRENTLY idx_payments_user_status_created
ON payments(user_id, status, created_at);

CREATE INDEX CONCURRENTLY idx_products_channel_active
ON products(channel_id, is_active);

-- Настройка Connection Pool
-- В Vercel автоматически используется PgBouncer
-- Пул соединений: 10 connections
```

#### 📋 Миграции данных

```bash
# Создание миграции для продакшн
npx prisma migrate dev --name init_production

# Применение миграций
npx prisma migrate deploy

# Генерация клиента
npx prisma generate

# Заполнение начальных данных
npx prisma db seed
```

### 💾 Резервное копирование

#### 🔄 Автоматические бэкапы
```bash
# Vercel Postgres автоматически создает бэкапы:
# - Ежедневные бэкапы (хранятся 30 дней)
# - Еженедельные бэкапы (хранятся 4 недели)
# - Ежемесячные бэкапы (храняются 12 месяцев)

# Ручное создание бэкапа через Vercel CLI
vercel postgres backup create
```

#### 📥 Восстановление данных
```bash
# Восстановление из бэкапа
vercel postgres backup restore <backup-id>

# Экспорт данных
pg_dump $POSTGRES_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Импорт данных
psql $POSTGRES_URL < backup_20240101_120000.sql
```

---

## 🚀 Развертывание приложения

### 📦 Сборка и деплой

#### 🏗️ Сборка проекта
```bash
# Установка зависимостей
npm ci --only=production

# Генерация Prisma клиента
npx prisma generate

# Сборка приложения
npm run build

# Проверка типа
npm run type-check
```

#### 🚀 Деплой через Vercel CLI
```bash
# Авторизация в Vercel
vercel login

# Развертывание в продакшн
vercel --prod

# Проверка деплоя
vercel ls
vercel inspect
```

#### 🔄 CI/CD через GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build application
        run: npm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 🔒 Безопасность в продакшн

### 🛡️ SSL и HTTPS

```typescript
// next.config.js
const nextConfig = {
  // Принудительное перенаправление на HTTPS
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};
```

### 🔐 Rate Limiting

```typescript
// lib/security/rateLimit.prod.ts
import rateLimit from 'express-rate-limit';

export const prodRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,

  // Redis для хранения счетчиков
  store: new RedisStore({
    client: redis,
    prefix: 'rl:'
  })
});
```

### 🚫 Защита от атак

```typescript
// lib/security/protection.ts
export const securityConfig = {
  // Защита от brute force
  bruteForce: {
    maxAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 минут
    resetTime: 60 * 60 * 1000 // 1 час
  },

  // Защита от SQL injection
  sqlInjection: {
    validation: true,
    sanitization: true
  },

  // Защита от XSS
  xss: {
    enabled: true,
    header: true,
    content: true
  }
};
```

---

## 📊 Мониторинг и логирование

### 📈 Vercel Analytics

```typescript
// lib/analytics/prod.ts
import { getAnalytics } from '@vercel/analytics/server';

export const trackEvent = async (eventName: string, properties?: any) => {
  if (process.env.NODE_ENV === 'production') {
    getAnalytics().track(eventName, properties);
  }
};

// Отслеживание ключевых событий
await trackEvent('payment_completed', {
  amount: payment.amount,
  currency: payment.currency,
  product_id: payment.product_id
});
```

### 🔍 Sentry для ошибок

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  debug: false,

  // Фильтрация ошибок
  beforeSend(event) {
    if (event.exception) {
      const error = event.exception.values?.[0];
      if (error?.value?.includes('Rate limit exceeded')) {
        return null; // Игнорировать ошибки rate limiting
      }
    }
    return event;
  }
});
```

### 📋 Health Checks

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    tonApi: await checkTonApi(),
    telegramApi: await checkTelegramApi()
  };

  const isHealthy = Object.values(checks).every(check => check.status === 'ok');

  return Response.json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  }, {
    status: isHealthy ? 200 : 503
  });
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', latency: Date.now() };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}
```

---

## ⚡ Оптимизация производительности

### 🚀 Кэширование

```typescript
// lib/cache/redis.ts
import { kv } from '@vercel/kv';

export const cacheConfig = {
  // Кэширование продуктов
  products: {
    ttl: 300, // 5 минут
    key: (id?: number) => `products:${id || 'all'}`
  },

  // Кэширование пользовательских данных
  user: {
    ttl: 600, // 10 минут
    key: (userId: number) => `user:${userId}`
  },

  // Кэширование статистики
  stats: {
    ttl: 1800, // 30 минут
    key: (type: string, period: string) => `stats:${type}:${period}`
  }
};

export async function getCachedData<T>(key: string, fetcher: () => Promise<T>, ttl = 300): Promise<T> {
  // Проверяем кэш
  let cached = await kv.get<T>(key);

  if (cached) {
    return cached;
  }

  // Получаем свежие данные
  const data = await fetcher();

  // Сохраняем в кэш
  await kv.set(key, data, { ex: ttl });

  return data;
}
```

### 📦 Оптимизация изображений

```typescript
// next.config.js
const nextConfig = {
  images: {
    domains: ['yourdomain.com', 'cdn.yourdomain.com'],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60
  }
};
```

### 🌍 CDN оптимизация

```typescript
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        {/* Preconnect к внешним ресурсам */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://api.telegram.org" />
        <link rel="preconnect" href="https://toncenter.com" />

        {/* DNS prefetch */}
        <link rel="dns-prefetch" href="https://cdn.vercel.app" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
```

---

## 🎯 Пост-деплой проверки

### ✅ Чек-лист продакшн развертывания

#### 🌐 Проверка функциональности
- [ ] **Основной сайт** открывается по домену
- [ ] **SSL сертификат** установлен и работает
- [ ] **API эндпоинты** отвечают корректно
- [ ] **Telegram бот** работает и отвечает на команды
- [ ] **Mini App** открывается внутри Telegram
- [ ] **NOWPayments** интеграция работает

#### 💳 Проверка платежей
- [ ] **Инициация платежа** создает правильную транзакцию
- [ ] **Верификация платежа** работает с NOWPayments API
- [ ] **Автоматическое добавление** в каналы работает
- [ ] **История платежей** отображается корректно
- [ ] **Промокоды** применяются правильно

#### 👥 Проверка админ-панели
- [ ] **Авторизация** работает
- [ ] **Статистика** отображается
- [ ] **Управление продуктами** работает
- [ ] **Рассылки** отправляются
- [ ] **Управление пользователями** работает

#### 🔒 Проверка безопасности
- [ ] **Rate limiting** работает
- [ ] **HTTPS редирект** работает
- [ ] **Security headers** установлены
- [ ] **XSS защита** работает
- [ ] **CSRF защита** работает

#### 📊 Проверка мониторинга
- [ ] **Analytics** собирает данные
- [ ] **Sentry** ловит ошибки
- [ ] **Health checks** работают
- [ ] **Логи** пишутся корректно
- [ ] **Alerts** настроены

### 🧪 Нагрузочное тестирование

```bash
# Установка инструментов
npm install -g artillery

# Тестирование API
artillery run load-test-api.yml

# Тестирование веб-интерфейса
artillery run load-test-web.yml
```

**Пример конфигурации нагрузки:**
```yaml
# load-test-api.yml
config:
  target: 'https://yourdomain.com'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 20
    - duration: 60
      arrivalRate: 50

scenarios:
  - name: "API Load Test"
    weight: 70
    flow:
      - get:
          url: "/api/products"
      - think: 1
      - post:
          url: "/api/payment/initiate"
          json:
            product_id: 1

  - name: "Health Check"
    weight: 30
    flow:
      - get:
          url: "/api/health"
```

---

## 🚨 Обработка инцидентов

### 📋 План действий при сбоях

#### 🔥 Критические инциденты (P0)
1. **Немедленно**: Проверить status.vercel.com
2. **В течение 5 минут**: Оценить влияние на пользователей
3. **В течение 15 минут**: Определить корневую причину
4. **В течение 30 минут**: Применить исправление
5. **В течение 1 часа**: Восстановить полную функциональность

#### ⚠️ Средние инциденты (P1)
1. **В течение 30 минут**: Определить проблему
2. **В течение 2 часов**: Исправить проблему
3. **В течение 4 часов**: Проверить восстановление

#### 📊 Низкие инциденты (P2)
1. **В течение 24 часов**: Исправить проблему
2. **В течение 48 часов**: Тестирование исправления

### 📞 Коммуникация при сбоях

```typescript
// Шаблон уведомления о сбое
const incidentNotification = {
  title: "🚨 Сервис временно недоступен",
  message: "Мы работаем над восстановлением. Ожидаемое время: 30 минут",
  channels: ["telegram_bot", "email", "status_page"],

  // Статусы
  statuses: {
    investigating: "🔍 Мы исследуем проблему",
    identified: "🎯 Проблема определена",
    monitoring: "📊 Следим за восстановлением",
    resolved: "✅ Проблема решена"
  }
};
```

---

## 📈 Масштабирование

### 📊 План масштабирования

#### 🎯 До 1000 пользователей
- **Vercel Pro** план
- **Postgres Start** план
- **Basic мониторинг**
- **Один регион развертывания**

#### 🚀 До 10,000 пользователей
- **Vercel Pro** план
- **Postgres Pro** план
- **Advanced мониторинг**
- **Мультирегиональное развертывание**

#### 🏆 До 100,000+ пользователей
- **Vercel Enterprise** план
- **Postgres Enterprise** план
- **Full monitoring suite**
- **Глобальная инфраструктура**

### 💰 Оценка затрат

| Компонент | Start | Pro | Enterprise |
|-----------|-------|-----|------------|
| Vercel | $0 | $20/месяц | $500+/месяц |
| Postgres | $0 | $20/месяц | $200+/месяц |
| Redis | $0 | $5/месяц | $50+/месяц |
| Domain | $12/год | $12/год | $12/год |
| Monitoring | $0 | $26/месяц | $100+/месяц |
| **Итого** | **$12/год** | **~$73/месяц** | **$862+/месяц** |

---

**🎉 Поздравляем! Ваша система готова к продакшн эксплуатации и масштабированию!**

[🔒 Безопасность](./security.md) | [🛠️ Устранение проблем](./troubleshooting.md)