# API Справочник

## 📡 Полная документация API

Система предоставляет RESTful API для всех операций с подписками, платежами и пользователями.

---

## 🔐 Аутентификация

### Telegram WebApp аутентификация
Все запросы от пользователей должны включать Telegram WebApp данные в заголовке:

```typescript
// Пример аутентификации
const headers = {
  'X-Telegram-Init-Data': telegramInitData,
  'Content-Type': 'application/json'
};
```

### Администраторская аутентификация
Админские эндпоинты требуют JWT токен:

```typescript
// Пример авторизации админа
const headers = {
  'Authorization': `Bearer ${jwtToken}`,
  'Content-Type': 'application/json'
};
```

---

## 👤 Пользовательские API

### 📋 Получить продукты

**GET** `/api/products`

Получение списка доступных для покупки продуктов.

```typescript
// Запрос
GET /api/products

// Ответ
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Базовый доступ",
      "description": "Доступ к основному контенту",
      "price": "29.00",
      "currency": "USDT",
      "period_days": 30,
      "discount_price": "19.00",
      "is_trial": false,
      "is_active": true,
      "channel": {
        "id": 1,
        "username": "premium_channel",
        "title": "Premium Channel"
      }
    }
  ]
}
```

**Параметры запроса:**
- `category` (опционально) - фильтрация по категории
- `active_only` (опционально) - только активные продукты
- `channel_id` (опционально) - фильтрация по каналу

### 💳 Инициация платежа

**POST** `/api/payment/initiate`

Создание нового платежа и получение данных для транзакции.

```typescript
// Запрос
POST /api/payment/initiate
{
  "product_id": 1,
  "promo_code": "WELCOME10" // опционально
}

// Ответ
{
  "success": true,
  "data": {
    "payment_id": "pay_1234567890",
    "amount": "29.00",
    "currency": "USDT",
    "wallet_address": "EQD...123",
    "memo": "TMA_PAY_pay_1234567890",
    "transaction": {
      "to": "EQD...123",
      "amount": "29.00", // в долларах
      "payload": "base64_encoded_payload"
    },
    "expires_at": "2024-01-01T12:00:00Z"
  }
}
```

**Валидация:**
- `product_id` должен существовать и быть активным
- Пользователь должен быть авторизован через Telegram
- Промокод проверяется на валидность

### ✅ Верификация платежа

**POST** `/api/payment/verify`

Проверка статуса платежа после транзакции.

```typescript
// Запрос
POST /api/payment/verify
{
  "payment_id": "pay_1234567890",
  "tx_hash": "0x123...abc"
}

// Ответ (успех)
{
  "success": true,
  "data": {
    "status": "verified",
    "subscription": {
      "id": "sub_1234567890",
      "product_name": "Базовый доступ",
      "channel_username": "premium_channel",
      "expires_at": "2024-02-01T12:00:00Z"
    }
  }
}

// Ответ (ошибка)
{
  "success": false,
  "error": {
    "code": "TRANSACTION_NOT_FOUND",
    "message": "Транзакция не найдена в блокчейне"
  }
}
```

### 📱 Подписки пользователя

**GET** `/api/user/subscriptions`

Получение списка активных подписок пользователя.

```typescript
// Запрос
GET /api/user/subscriptions
Headers: X-Telegram-Init-Data

// Ответ
{
  "success": true,
  "data": [
    {
      "id": "sub_1234567890",
      "product": {
        "id": 1,
        "name": "Базовый доступ",
        "channel": {
          "username": "premium_channel",
          "title": "Premium Channel"
        }
      },
      "status": "active",
      "starts_at": "2024-01-01T12:00:00Z",
      "expires_at": "2024-02-01T12:00:00Z",
      "days_left": 15,
      "auto_renew": false
    }
  ]
}
```

### 💰 История платежей

**GET** `/api/user/payments`

Получение истории платежей пользователя.

```typescript
// Запрос
GET /api/user/payments?limit=10&offset=0
Headers: X-Telegram-Init-Data

// Ответ
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "pay_1234567890",
        "amount": "29.00",
        "currency": "USDT",
        "status": "completed",
        "product_name": "Базовый доступ",
        "created_at": "2024-01-01T12:00:00Z",
        "verified_at": "2024-01-01T12:01:00Z"
      }
    ],
    "total": 5,
    "has_more": false
  }
}
```

**Параметры запроса:**
- `limit` (опционально) - количество записей (по умолчанию 10)
- `offset` (опционально) - смещение
- `status` (опционально) - фильтр по статусу

### 🎁 Промокоды

**POST** `/api/promocodes/validate`

Валидация промокода.

```typescript
// Запрос
POST /api/promocodes/validate
{
  "code": "WELCOME10",
  "product_id": 1
}

// Ответ
{
  "success": true,
  "data": {
    "valid": true,
    "discount": {
      "type": "percentage",
      "value": 10,
      "final_price": "26.10"
    },
    "message": "Промокод применен! Скидка 10%"
  }
}
```

**POST** `/api/promocodes/apply`

Применение промокода к платежу.

```typescript
// Запрос
POST /api/promocodes/apply
{
  "payment_id": "pay_1234567890",
  "code": "WELCOME10"
}

// Ответ
{
  "success": true,
  "data": {
    "discount_applied": true,
    "original_amount": "29.00",
    "discounted_amount": "26.10",
    "discount_amount": "2.90"
  }
}
```

---

## 👨‍💼 Административные API

### 🔐 Авторизация администратора

**POST** `/api/admin/auth`

Получение JWT токена для доступа к админ-панели.

```typescript
// Запрос
POST /api/admin/auth
Headers: X-Telegram-Init-Data

// Ответ
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "admin": {
      "telegram_id": 123456789,
      "role": "super_admin",
      "permissions": ["all"]
    },
    "expires_in": 86400
  }
}
```

### 📊 Статистика системы

**GET** `/api/admin/stats`

Получение общей статистики системы.

```typescript
// Запрос
GET /api/admin/stats
Headers: Authorization: Bearer {token}

// Ответ
{
  "success": true,
  "data": {
    "overview": {
      "total_users": 1250,
      "active_subscriptions": 342,
      "total_revenue": "15234.50",
      "monthly_revenue": "3456.78"
    },
    "recent_activity": [
      {
        "type": "payment_completed",
        "user_id": 123456789,
        "amount": "29.00",
        "timestamp": "2024-01-01T12:00:00Z"
      }
    ],
    "chart_data": {
      "daily_revenue": [
        {"date": "2024-01-01", "revenue": "234.56"},
        {"date": "2024-01-02", "revenue": "345.67"}
      ]
    }
  }
}
```

### 🛍️ Управление продуктами

**POST** `/api/admin/products`

Создание нового продукта.

```typescript
// Запрос
POST /api/admin/products
Headers: Authorization: Bearer {token}
{
  "channel_id": 1,
  "name": "VIP доступ",
  "description": "Эксклюзивный контент",
  "price": "99.00",
  "period_days": 30,
  "discount_price": "79.00",
  "is_trial": false,
  "trial_days": 0,
  "is_active": true
}

// Ответ
{
  "success": true,
  "data": {
    "id": 2,
    "name": "VIP доступ",
    "price": "99.00",
    "created_at": "2024-01-01T12:00:00Z"
  }
}
```

**PUT** `/api/admin/products/{id}`

Обновление существующего продукта.

**DELETE** `/api/admin/products/{id}`

Удаление продукта.

### 📺 Управление каналами

**POST** `/api/admin/channels`

Добавление нового Telegram канала.

```typescript
// Запрос
POST /api/admin/channels
Headers: Authorization: Bearer {token}
{
  "channel_id": -1001234567890,
  "username": "exclusive_channel",
  "title": "Exclusive Content",
  "description": "Эксклюзивный контент для подписчиков"
}

// Ответ
{
  "success": true,
  "data": {
    "id": 2,
    "channel_id": -1001234567890,
    "username": "exclusive_channel",
    "is_active": true
  }
}
```

### 👥 Управление пользователями

**GET** `/api/admin/users`

Поиск и получение списка пользователей.

```typescript
// Запрос
GET /api/admin/users?search=username&limit=20&offset=0
Headers: Authorization: Bearer {token}

// Ответ
{
  "success": true,
  "data": {
    "users": [
      {
        "telegram_id": 123456789,
        "username": "john_doe",
        "first_name": "John",
        "last_name": "Doe",
        "created_at": "2024-01-01T12:00:00Z",
        "total_spent": "116.00",
        "active_subscriptions": 2
      }
    ],
    "total": 1250,
    "has_more": true
  }
}
```

**POST** `/api/admin/grant_subscription`

Ручная выдача подписки пользователю.

```typescript
// Запрос
POST /api/admin/grant_subscription
Headers: Authorization: Bearer {token}
{
  "user_id": 123456789,
  "product_id": 1,
  "custom_days": 30, // опционально
  "reason": "Промо акция"
}

// Ответ
{
  "success": true,
  "data": {
    "subscription_id": "sub_manual_1234567890",
    "user_id": 123456789,
    "product_name": "Базовый доступ",
    "expires_at": "2024-02-01T12:00:00Z"
  }
}
```

**POST** `/api/admin/revoke_subscription`

Отзыв подписки пользователя.

### 📢 Управление рассылками

**POST** `/api/admin/broadcasts`

Создание новой рассылки.

```typescript
// Запрос
POST /api/admin/broadcasts
Headers: Authorization: Bearer {token}
{
  "name": "Новогодняя акция",
  "message": "🎅 Скидка 30% на все подписки до конца года!",
  "send_type": "scheduled",
  "scheduled_at": "2024-01-01T10:00:00Z",
  "filters": [
    {
      "type": "subscription_status",
      "value": "expired"
    },
    {
      "type": "last_payment",
      "value": "30_days_ago"
    }
  ]
}

// Ответ
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Новогодняя акция",
    "status": "scheduled",
    "estimated_recipients": 250
  }
}
```

**GET** `/api/admin/broadcasts/{id}/stats`

Статистика рассылки.

---

## 🔄 Webhook API

### 📨 Telegram Webhook

**POST** `/api/webhook/telegram`

Обработка входящих сообщений и событий от Telegram.

```typescript
// Входящий вебхук от Telegram
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 123456789,
      "first_name": "John",
      "username": "john_doe"
    },
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "text": "/start"
  }
}
```

### 💳 NOWPayments Webhook

**POST** `/api/payment/webhook/nowpayments`

Обработка платежных уведомлений от NOWPayments.

```typescript
// Входящий вебхук от NOWPayments
{
  "payment_status": "finished",
  "payment_id": "NP1234567890",
  "pay_address": "1234567890abcdef",
  "price_amount": "29.00",
  "price_currency": "USDT",
  "actually_paid": "29.00",
  "order_id": "pay_1234567890",
  "order_description": "Оплата подписки"
}
```

---

## ⏰ Cron Jobs API

### 🔍 Проверка подписок

**GET** `/api/cron/check-subscriptions`

Автоматическая проверка истекших подписок.

```typescript
// Запуск (только через Vercel Cron)
GET /api/cron/check-subscriptions

// Ответ
{
  "success": true,
  "data": {
    "checked_subscriptions": 342,
    "expired_subscriptions": 15,
    "processed": true,
    "execution_time": "2.34s"
  }
}
```

### 🎪 Проверка демо-доступа

**GET** `/api/cron/check-demo-access`

Проверка истекших демо-периодов.

### 📢 Плановые рассылки

**GET** `/api/cron/scheduled-broadcasts`

Отправка запланированных рассылок.

---

## 🚨 Обработка ошибок

### Формат ошибок

```typescript
// Стандартный формат ошибки
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Неверные входные данные",
    "details": {
      "field": "product_id",
      "issue": "Продукт не найден"
    }
  }
}
```

### Коды ошибок

| Код | Описание | HTTP статус |
|-----|----------|-------------|
| `VALIDATION_ERROR` | Ошибка валидации данных | 400 |
| `UNAUTHORIZED` | Пользователь не авторизован | 401 |
| `FORBIDDEN` | Недостаточно прав | 403 |
| `NOT_FOUND` | Ресурс не найден | 404 |
| `PAYMENT_REQUIRED` | Требуется оплата | 402 |
| `PAYMENT_FAILED` | Платеж не прошел | 400 |
| `SUBSCRIPTION_EXPIRED` | Подписка истекла | 403 |
| `RATE_LIMIT_EXCEEDED` | Превышен лимит запросов | 429 |
| `INTERNAL_ERROR` | Внутренняя ошибка сервера | 500 |

---

## 📊 Статусы и состояния

### Статусы платежей

- `pending` - ожидание оплаты
- `processing` - обработка транзакции
- `completed` - платеж успешно завершен
- `failed` - платеж не прошел
- `expired` - время ожидания истекло
- `refunded` - платеж возвращен

### Статусы подписок

- `active` - активна
- `expired` - истекла
- `cancelled` - отменена
- `pending` - ожидает активации

### Статусы рассылок

- `draft` - черновик
- `scheduled` - запланирована
- `sending` - отправляется
- `completed` - завершена
- `cancelled` - отменена

---

## 🔧 Rate Limiting

### Лимиты API

| Эндпоинт | Лимит | Период |
|----------|-------|--------|
| `/api/payment/initiate` | 5 запросов | 15 минут |
| `/api/admin/*` | 100 запросов | 15 минут |
| `/api/auth/*` | 10 запросов | 1 час |
| Все остальные | 1000 запросов | 15 минут |

### Заголовки лимитов

```typescript
// В ответах API включаются заголовки
{
  "X-RateLimit-Limit": "100",
  "X-RateLimit-Remaining": "95",
  "X-RateLimit-Reset": "1640995200"
}
```

---

## 📝 Примеры использования

### Пример полной покупки

```typescript
// 1. Получаем продукты
const products = await fetch('/api/products', {
  headers: { 'X-Telegram-Init-Data': telegramData }
});

// 2. Инициируем платеж
const payment = await fetch('/api/payment/initiate', {
  method: 'POST',
  headers: {
    'X-Telegram-Init-Data': telegramData,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    product_id: 1,
    promo_code: 'WELCOME10'
  })
});

// 3. Создаем транзакцию через NOWPayments
const result = await tonConnect.sendTransaction(payment.data.transaction);

// 4. Верифицируем платеж
const verification = await fetch('/api/payment/verify', {
  method: 'POST',
  headers: {
    'X-Telegram-Init-Data': telegramData,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    payment_id: payment.data.payment_id,
    tx_hash: result.boc
  })
});
```

### Пример работы с админ-панелью

```typescript
// 1. Авторизация админа
const auth = await fetch('/api/admin/auth', {
  method: 'POST',
  headers: { 'X-Telegram-Init-Data': telegramData }
});

// 2. Получение статистики
const stats = await fetch('/api/admin/stats', {
  headers: {
    'Authorization': `Bearer ${auth.data.token}`
  }
});

// 3. Создание продукта
const product = await fetch('/api/admin/products', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${auth.data.token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    channel_id: 1,
    name: 'Новый продукт',
    price: '49.00',
    period_days: 30
  })
});
```

---

**🎯 API готов к использованию! Все эндпоинты поддерживают CORS и оптимизированы для высокой производительности.**

[🗄️ Структура базы данных](./database.md) | [🔒 Безопасность](./security.md)