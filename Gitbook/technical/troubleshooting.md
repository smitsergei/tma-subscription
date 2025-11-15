# Устранение проблем

## 🛠️ Гайд по решению частых проблем

Полное руководство по диагностике и устранению проблем в системе TMA-Подписка.

---

## 🔍 Диагностика проблем

### 📊 Quick Diagnosis Checklist

#### 🚨 Критические проблемы (немедленная реакция)
- [ ] **Сайт недоступен** - Проверить Vercel status
- [ ] **Платежи не проходят** - Проверить NOWPayments API и кошелек
- [ ] **Бот не отвечает** - Проверить webhook и токен
- [ ] **База данных недоступна** - Проверить Vercel Storage

#### ⚠️ Средние проблемы (реакция в течение часа)
- [ ] **Mini App не открывается** - Проверить конфигурацию
- [ ] **Подписки не активируются** - Проверить cron jobs
- [ ] **Админ-панель не работает** - Проверить права доступа
- [ ] **Медленная работа** - Проверить производительность

#### 📝 Низкие проблемы (реакция в течение дня)
- [ ] **Статистика не обновляется** - Проверить аналитику
- [ ] **Email не отправляются** - Проверить SMTP настройки
- [ ] **UI отображается некорректно** - Проверить фронтенд
- [ ] **Логи ошибок** - Проанализировать сообщения

---

## 🌐 Проблемы с вебхуками и ботом

### 🤖 Telegram Bot не отвечает

#### 🔍 Диагностика
```bash
# 1. Проверка токена бота
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getMe"

# 2. Проверка статуса вебхука
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"

# 3. Проверка доступности API
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://yourdomain.com/api/webhook/telegram"
```

#### ⚙️ Решения

**Проблема: Неверный токен бота**
```bash
# Решение: Получите новый токен у @BotFather
# Обновите переменную окружения BOT_TOKEN в Vercel
vercel env add BOT_TOKEN production
```

**Проблема: Вебхук не установлен**
```bash
# Решение: Переустановите вебхук
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=https://yourdomain.com/api/webhook/telegram" \
  -d "secret_token=<YOUR_BOT_SECRET>"
```

**Проблема: Вебхук возвращает ошибки**
```typescript
// app/api/webhook/telegram/route.ts - добавьте логирование
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Webhook received:', body);

    // Ваша логика обработки

    return Response.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 📱 Mini App не открывается

#### 🔍 Диагностика
```bash
# 1. Проверка доступности Mini App URL
curl -I "https://yourdomain.com/app"

# 2. Проверка конфигурации в @BotFather
# BotFather → Bot Settings → Menu Button

# 3. Проверка валидации initData
```

#### ⚙️ Решения

**Проблема: Неверный URL Mini App**
```bash
# Установите правильный URL в @BotFather
/start
/botsettings
/menubutton
/setwebapp
```

**Проблема: Ошибка валидации Telegram WebApp**
```typescript
// lib/debug/telegram.ts - временная диагностика
export function debugTelegramValidation(initData: string, botToken: string) {
  console.log('InitData:', initData);
  console.log('BotToken:', botToken.substring(0, 10) + '...');

  const isValid = validateTelegramWebApp(initData, botToken);
  console.log('Validation result:', isValid);

  if (!isValid) {
    console.error('WebApp validation failed!');
    return false;
  }

  return true;
}
```

---

## 💳 Проблемы с платежами

### 🔗 NOWPayments не работает

#### 🔍 Диагностика
```typescript
// lib/debug/ton.ts
export async function debugTonConnection() {
  const issues = [];

  // 1. Проверка API ключа
  try {
    const response = await fetch('https://toncenter.com/api/v3/getAddressBalance', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.NOWPAYMENTS_API_KEY!
      },
      body: JSON.stringify({ address: process.env.NOWPAYMENTS_API_KEY })
    });

    if (!response.ok) {
      issues.push('NOWPayments Center API key invalid or exhausted');
    }
  } catch (error) {
    issues.push('NOWPayments Center API unavailable');
  }

  // 2. Проверка баланса кошелька
  try {
    const balance = await getWalletBalance();
    console.log('Wallet balance:', balance);
  } catch (error) {
    issues.push('Wallet balance check failed');
  }

  return issues;
}
```

#### ⚙️ Решения

**Проблема: API ключ NOWPayments Center истек**
```bash
# 1. Получите новый ключ на toncenter.com
# 2. Обновите переменную окружения
vercel env add NOWPAYMENTS_API_KEY production

# 3. Перезапустите функции
vercel functions list
vercel functions restart
```

**Проблема: Транзакция не проходит**
```typescript
// lib/debug/transaction.ts
export async function debugTransaction(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { payment_id: paymentId }
  });

  if (!payment) {
    return { error: 'Payment not found' };
  }

  // Проверка транзакции в блокчейне
  const verifier = new PaymentVerifier();
  const isValid = await verifier.verifyTransaction(
    payment.tx_hash!,
    payment.amount,
    process.env.NOWPAYMENTS_API_KEY!
  );

  return {
    payment,
    transactionValid: isValid,
    issues: []
  };
}
```

### ⏰ Платежи "застревают" в статусе pending

#### 🔍 Диагностика
```sql
-- Проверка "зависших" платежей
SELECT
  payment_id,
  status,
  created_at,
  expires_at,
  NOW() as current_time,
  NOW() - expires_at as expired_duration
FROM payments
WHERE status = 'pending'
  AND expires_at < NOW()
ORDER BY created_at DESC;
```

#### ⚙️ Решения

**Создание скрипта очистки:**
```typescript
// scripts/clean-expired-payments.ts
async function cleanExpiredPayments() {
  const expiredPayments = await prisma.payment.findMany({
    where: {
      status: 'pending',
      expires_at: {
        lt: new Date()
      }
    }
  });

  console.log(`Found ${expiredPayments.length} expired payments`);

  for (const payment of expiredPayments) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'expired' }
    });

    console.log(`Expired payment ${payment.payment_id}`);
  }
}
```

---

## 🗄️ Проблемы с базой данных

### 🔌 Connection Pool исчерпан

#### 🔍 Диагностика
```sql
-- Проверка активных соединений
SELECT
  state,
  COUNT(*) as connection_count
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;

-- Проверка долгих запросов
SELECT
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

#### ⚙️ Решения

**Оптимизация connection pool:**
```typescript
// lib/db/prisma.ts
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.POSTGRES_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],

  // Оптимизация для serverless
  __internal: {
    engine: {
      connectionLimit: 10, // Уменьшить лимит
      poolTimeout: 10000,  // 10 секунд
      idleTimeout: 30000,  // 30 секунд
    },
  },
});
```

**Добавление индексов для оптимизации:**
```sql
-- Индексы для частых запросов
CREATE INDEX CONCURRENTLY idx_payments_status_expires
ON payments(status, expires_at)
WHERE status = 'pending';

CREATE INDEX CONCURRENTLY idx_subscriptions_expires_active
ON subscriptions(expires_at)
WHERE status = 'active';
```

### 📊 Медленные запросы

#### 🔍 Диагностика
```sql
-- Включение pg_stat_statements если еще не включен
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Поиск медленных запросов
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  rows
FROM pg_stat_statements
WHERE mean_exec_time > 1000 -- больше 1 секунды
ORDER BY mean_exec_time DESC
LIMIT 20;
```

#### ⚙️ Решения

**Кэширование частых запросов:**
```typescript
// lib/cache/queries.ts
export async function getCachedProducts() {
  return getCachedData(
    'products:all',
    async () => {
      return prisma.product.findMany({
        where: { is_active: true },
        include: {
          channel: true
        },
        orderBy: { sort_order: 'asc' }
      });
    },
    300 // 5 минут
  );
}

export async function getCachedUserSubscriptions(userId: number) {
  return getCachedData(
    `subscriptions:${userId}`,
    async () => {
      return prisma.subscription.findMany({
        where: {
          user_id: userId,
          status: 'active',
          expires_at: { gt: new Date() }
        },
        include: {
          product: {
            include: {
              channel: true
            }
          }
        }
      });
    },
    60 // 1 минута
  );
}
```

---

## ⏰ Проблемы с Cron Jobs

### 🕐 Cron задачи не выполняются

#### 🔍 Диагностика
```bash
# 1. Проверка статуса cron в Vercel Dashboard
# Vercel → Project → Settings → Functions → Cron Jobs

# 2. Проверка логов выполнения
vercel logs --filter="cron"

# 3. Ручной запуск для теста
curl "https://yourdomain.com/api/cron/check-subscriptions"
```

#### ⚙️ Решения

**Проблема: Неверный URL cron job**
```json
// vercel.json - правильная конфигурация
{
  "crons": [
    {
      "path": "/api/cron/check-subscriptions",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Проблема: Timeout функции**
```typescript
// app/api/cron/check-subscriptions/route.ts
export async function GET() {
  const startTime = Date.now();

  try {
    // Увеличение timeout для cron
    const maxDuration = 5 * 60 * 1000; // 5 минут

    // Основная логика
    const result = await checkSubscriptions();

    const duration = Date.now() - startTime;
    console.log(`Cron completed in ${duration}ms`);

    return Response.json(result);
  } catch (error) {
    console.error('Cron failed:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

**Пакетная обработка для больших объемов:**
```typescript
async function checkSubscriptionsBatch(batchSize = 100) {
  let offset = 0;
  let totalProcessed = 0;

  while (true) {
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        expires_at: { lt: new Date() }
      },
      take: batchSize,
      skip: offset,
      include: {
        user: true,
        channel: true
      }
    });

    if (subscriptions.length === 0) break;

    // Обработка пакета
    await processSubscriptionBatch(subscriptions);

    totalProcessed += subscriptions.length;
    offset += batchSize;

    console.log(`Processed batch: ${totalProcessed} subscriptions`);
  }

  return { processed: totalProcessed };
}
```

---

## 📱 Проблемы с производительностью

### 🐌 Медленная загрузка Mini App

#### 🔍 Диагностика
```typescript
// lib/debug/performance.ts
export function measurePerformance(name: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      const result = await method.apply(this, args);
      const end = performance.now();

      console.log(`${name} took ${end - start} milliseconds`);
      return result;
    };
  };
}
```

#### ⚙️ Решения

**Оптимизация загрузки данных:**
```typescript
// app/app/page.tsx
export default async function TmaPage() {
  // Параллельная загрузка данных
  const [products, userSubscriptions] = await Promise.all([
    getCachedProducts(),
    getUserSubscriptions(telegramId)
  ]);

  return <TmaPageContent products={products} subscriptions={userSubscriptions} />;
}
```

**Lazy loading компонентов:**
```typescript
// components/ProductList.tsx
import dynamic from 'next/dynamic';

const ProductCard = dynamic(() => import('./ProductCard'), {
  loading: () => <div>Loading...</div>,
  ssr: false
});

export function ProductList({ products }) {
  return (
    <div>
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

### 📈 Высокая нагрузка на API

#### 🔍 Диагностика
```bash
# Мониторинг нагрузки через Vercel Analytics
vercel analytics

# Проверка rate limiting
curl -H "X-Forwarded-For: 192.168.1.1" \
     https://yourdomain.com/api/products

# Проверка ответов API
time curl https://yourdomain.com/api/products
```

#### ⚙️ Решения

**Усиление rate limiting:**
```typescript
// lib/security/rateLimit.ts
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 10, // 10 запросов
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  standardHeaders: true,
  legacyHeaders: false
});
```

**Кэширование API ответов:**
```typescript
// app/api/products/route.ts
export async function GET() {
  return getCachedData(
    'api:products',
    async () => {
      const products = await prisma.product.findMany({
        where: { is_active: true },
        include: { channel: true }
      });

      return Response.json({ success: true, data: products });
    },
    300 // 5 минут кэша
  );
}
```

---

## 🔧 Диагностические инструменты

### 📊 Health Check Endpoint

```typescript
// app/api/health/detailed/route.ts
export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,

    // Проверка базы данных
    database: await checkDatabase(),

    // Проверка Redis
    redis: await checkRedis(),

    // Проверка NOWPayments API
    tonApi: await checkTonApi(),

    // Проверка Telegram API
    telegramApi: await checkTelegramApi(),

    // Проверка дискового пространства
    diskSpace: await checkDiskSpace(),

    // Проверка памяти
    memory: checkMemory()
  };

  const isHealthy = Object.values(checks).every(
    check => typeof check === 'object' ? check.status === 'ok' : check
  );

  return Response.json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks
  }, {
    status: isHealthy ? 200 : 503
  });
}

async function checkDatabase() {
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return {
      status: 'ok',
      latency: `${latency}ms`
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}
```

### 🔍 Debug Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Логирование запросов в разработке
  if (process.env.NODE_ENV === 'development') {
    console.log(`${request.method} ${request.url}`);
    console.log('Headers:', Object.fromEntries(request.headers));
  }

  // Добавление заголовков для дебага
  const response = NextResponse.next();
  response.headers.set('X-Debug-Timestamp', new Date().toISOString());
  response.headers.set('X-Debug-Version', process.env.npm_package_version || 'unknown');

  return response;
}

export const config = {
  matcher: ['/api/:path*', '/app/:path*']
};
```

---

## 📞 Поиск помощи

### 🆘 Когда обратиться за помощью

#### 🚨 Немедленная помощь
- **Критические ошибки влияющие на платежи**
- **Утечка чувствительных данных**
- **DDoS атаки**
- **Полная неработоспособность сервиса**

#### 📞 Контакты для поддержки
1. **Vercel Support** - Проблемы с инфраструктурой
2. **Telegram Bot API** - Проблемы с ботом
3. **NOWPayments Center** - Проблемы с блокчейном
4. **Сообщество разработчиков** - Общие вопросы

### 📋 Сбор информации для поддержки

```typescript
// lib/debug/support-info.ts
export async function generateSupportInfo() {
  return {
    timestamp: new Date().toISOString(),

    // Информация о системе
    system: {
      version: process.env.npm_package_version,
      nodeVersion: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV
    },

    // Статистика
    stats: {
      totalUsers: await prisma.user.count(),
      activeSubscriptions: await prisma.subscription.count({
        where: { status: 'active' }
      }),
      totalRevenue: await prisma.payment.aggregate({
        where: { status: 'completed' },
        _sum: { amount: true }
      })
    },

    // Здоровье системы
    health: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      apis: {
        ton: await checkTonApi(),
        telegram: await checkTelegramApi()
      }
    },

    // Последние ошибки
    recentErrors: await getRecentErrors()
  };
}
```

### 📝 Шаблон запроса поддержки

```
Тема: [КРИТИЧНО] Проблема с платежами

Система: TMA-Подписка
Версия: 1.0.0
Окружение: Production

Описание проблемы:
[Подробное описание проблемы]

Шаги воспроизведения:
1. [Шаг 1]
2. [Шаг 2]
3. [Шаг 3]

Ожидаемый результат:
[Что должно было произойти]

Фактический результат:
[Что произошло на самом деле]

Логи ошибок:
[Relevant log entries]

Дополнительная информация:
[Любая дополнительная информация]
```

---

## 📚 Профилактика проблем

### 🔄 Регулярное обслуживание

#### Ежедневные проверки
- [ ] **Проверить health endpoint**
- [ ] **Просмотреть логи ошибок**
- [ ] **Проверить выполнение cron задач**
- [ ] **Мониторить производительность**

#### Еженедельные проверки
- [ ] **Аудит зависимостей на уязвимости**
- [ ] **Проверка бэкапов**
- [ ] **Анализ метрик производительности**
- [ ] **Обновление документации**

#### Ежемесячные проверки
- [ ] **Тестирование восстановления из бэкапов**
- [ ] **Аудит безопасности**
- [ ] **Оптимизация базы данных**
- [ ] **Планирование масштабирования**

### 🎯 Мониторинг ключевых метрик

```typescript
// lib/monitoring/metrics.ts
export const criticalMetrics = {
  // Бизнес метрики
  business: {
    dailyRevenue: 'revenue:daily',
    conversionRate: 'conversion:daily',
    activeUsers: 'users:active',
    churnRate: 'churn:monthly'
  },

  // Технические метрики
  technical: {
    apiResponseTime: 'api:response_time',
    errorRate: 'errors:rate',
    databaseConnections: 'db:connections',
    cronExecutionTime: 'cron:duration'
  },

  // Метрики безопасности
  security: {
    failedLogins: 'auth:failed',
    suspiciousTransactions: 'payments:suspicious',
    rateLimitHits: 'ratelimit:hits'
  }
};
```

---

**🎯 Профилактика лучше лечения! Регулярное обслуживание и мониторинг помогают предотвратить большинство проблем.**

[📊 API справочник](./api-reference.md) | [🗄️ База данных](./database.md)