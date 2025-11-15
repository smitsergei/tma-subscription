# Структура базы данных

## 🗄️ Детальное описание схемы данных

База данных PostgreSQL организована вокруг 15 основных таблиц, которые обеспечивают полный функционал системы подписок.

---

## 📊 Обзор архитектуры

### 💡 Принципы проектирования
- **Нормализация** до 3NF для избежания дублирования
- **Индексы** для быстрых запросов и масштабируемости
- **Связи** для обеспечения целостности данных
- **Аудит** для отслеживания изменений

### 🎯 Основные сущности
- **Users** - Пользователи системы
- **Admins** - Администраторы
- **Channels** - Telegram каналы
- **Products** - Платные продукты
- **Payments** - Финансовые транзакции
- **Subscriptions** - Активные подписки

---

## 📋 Детальная схема таблиц

### 👥 Users (Пользователи)

```sql
CREATE TABLE users (
  telegram_id BIGINT PRIMARY KEY,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  language_code VARCHAR(10),
  is_premium BOOLEAN DEFAULT false,
  photo_url TEXT,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login_at);
```

**Описание полей:**
- `telegram_id` - Уникальный ID пользователя в Telegram (PK)
- `username` - Имя пользователя в Telegram
- `first_name` - Имя пользователя
- `last_name` - Фамилия пользователя
- `language_code` - Код языка (ru, en и т.д.)
- `is_premium` - Премиум статус в Telegram
- `photo_url` - URL аватара пользователя

### 👨‍💼 Admins (Администраторы)

```sql
CREATE TABLE admins (
  telegram_id BIGINT PRIMARY KEY,
  role VARCHAR(50) DEFAULT 'admin',
  permissions TEXT[],
  email VARCHAR(255),
  last_login_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Индексы
CREATE INDEX idx_admins_role ON admins(role);
CREATE INDEX idx_admins_is_active ON admins(is_active);
```

**Описание полей:**
- `telegram_id` - ID администратора (FK к users)
- `role` - Роль (super_admin, admin, moderator)
- `permissions` - Массив прав (["users", "products", "analytics"])
- `email` - Email для уведомлений
- `is_active` - Активность администратора

### 📺 Channels (Telegram каналы)

```sql
CREATE TABLE channels (
  id SERIAL PRIMARY KEY,
  channel_id BIGINT UNIQUE NOT NULL,
  username VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  invite_link TEXT,
  member_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  auto_add_users BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX idx_channels_channel_id ON channels(channel_id);
CREATE INDEX idx_channels_username ON channels(username);
CREATE INDEX idx_channels_is_active ON channels(is_active);
```

**Описание полей:**
- `channel_id` - ID канала в Telegram
- `username` - Юзернейм канала (@channel_name)
- `title` - Название канала
- `invite_link` - Пригласительная ссылка
- `member_count` - Количество участников
- `auto_add_users` - Автоматически добавлять пользователей

### 🛍️ Products (Продукты/подписки)

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  channel_id BIGINT NOT NULL,
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
  category VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE
);

-- Индексы
CREATE INDEX idx_products_channel_id ON products(channel_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sort_order ON products(sort_order);
```

**Описание полей:**
- `channel_id` - ID связанного канала
- `name` - Название продукта
- `price` - Полная цена
- `discount_price` - Скидочная цена
- `period_days` - Период действия в днях
- `is_trial` - Пробный период
- `trial_days` - Дни пробного периода
- `category` - Категория продукта
- `metadata` - Дополнительные данные в JSON

### 💳 Payments (Платежи)

```sql
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  payment_id VARCHAR(255) UNIQUE NOT NULL,
  user_id BIGINT NOT NULL,
  product_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USDT',
  status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(50),
  tx_hash VARCHAR(255),
  memo VARCHAR(255),
  gateway_fee DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  promo_code VARCHAR(255),
  refund_amount DECIMAL(10,2) DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP,
  expires_at TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Индексы
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_tx_hash ON payments(tx_hash);
CREATE INDEX idx_payments_memo ON payments(memo);
CREATE INDEX idx_payments_created_at ON payments(created_at);
CREATE INDEX idx_payments_expires_at ON payments(expires_at);
```

**Описание полей:**
- `payment_id` - Уникальный ID платежа в системе
- `user_id` - ID пользователя
- `product_id` - ID продукта
- `status` - Статус (pending, processing, completed, failed, expired, refunded)
- `payment_method` - Способ оплаты (ton_connect, nowpayments)
- `tx_hash` - Хеш транзакции в блокчейне
- `memo` - Уникальный мемо для идентификации
- `gateway_fee` - Комиссия платежной системы
- `discount_amount` - Сумма скидки
- `promo_code` - Использованный промокод

### 📱 Subscriptions (Подписки)

```sql
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  subscription_id VARCHAR(255) UNIQUE NOT NULL,
  user_id BIGINT NOT NULL,
  product_id INTEGER NOT NULL,
  channel_id BIGINT NOT NULL,
  payment_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  cancelled_at TIMESTAMP,
  auto_renew BOOLEAN DEFAULT false,
  renewal_payment_id VARCHAR(255),
  trial_used BOOLEAN DEFAULT false,
  access_granted_at TIMESTAMP,
  access_revoked_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE SET NULL
);

-- Индексы
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_product_id ON subscriptions(product_id);
CREATE INDEX idx_subscriptions_channel_id ON subscriptions(channel_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at);
CREATE INDEX idx_subscriptions_auto_renew ON subscriptions(auto_renew);

-- Составные индексы
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX idx_subscriptions_expiring ON subscriptions(status, expires_at) WHERE status = 'active';
```

**Описание полей:**
- `subscription_id` - Уникальный ID подписки
- `status` - Статус (active, expired, cancelled, pending)
- `starts_at` - Дата начала действия
- `expires_at` - Дата окончания действия
- `auto_renew` - Автоматическое продление
- `trial_used` - Использован ли пробный период
- `access_granted_at` - Время предоставления доступа
- `access_revoked_at` - Время отзыва доступа

### 🎁 Discounts (Скидки)

```sql
CREATE TABLE discounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'percentage' or 'fixed'
  value DECIMAL(10,2) NOT NULL,
  min_product_id INTEGER, -- Применяется к продуктам от этого ID и выше
  max_discounts INTEGER DEFAULT NULL, -- Максимальное количество использований
  used_count INTEGER DEFAULT 0,
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by) REFERENCES admins(telegram_id) ON DELETE SET NULL
);

-- Индексы
CREATE INDEX idx_discounts_type ON discounts(type);
CREATE INDEX idx_discounts_is_active ON discounts(is_active);
CREATE INDEX idx_discounts_dates ON discounts(starts_at, expires_at);
```

**Описание полей:**
- `type` - Тип скидки (percentage, fixed)
- `value` - Значение скидки
- `min_product_id` - Минимальный ID продукта для применения
- `max_discounts` - Лимит использований
- `used_count` - Количество использований

### 🎫 Promocodes (Промокоды)

```sql
CREATE TABLE promocodes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  description TEXT,
  discount_id INTEGER NOT NULL,
  max_uses INTEGER DEFAULT NULL,
  used_count INTEGER DEFAULT 0,
  user_restriction VARCHAR(50) DEFAULT 'all', -- 'new', 'existing', 'all'
  min_amount DECIMAL(10,2),
  product_ids INTEGER[], -- Массив ID продуктов
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES admins(telegram_id) ON DELETE SET NULL
);

-- Индексы
CREATE INDEX idx_promocodes_code ON promocodes(code);
CREATE INDEX idx_promocodes_discount_id ON promocodes(discount_id);
CREATE INDEX idx_promocodes_is_active ON promocodes(is_active);
```

**Описание полей:**
- `code` - Уникальный код промокода
- `discount_id` - ID связанной скидки
- `user_restriction` - Ограничение для пользователей
- `min_amount` - Минимальная сумма заказа
- `product_ids` - Применимые продукты

### 📊 DiscountUsage (Использование скидок)

```sql
CREATE TABLE discount_usage (
  id SERIAL PRIMARY KEY,
  discount_id INTEGER NOT NULL,
  user_id BIGINT NOT NULL,
  payment_id VARCHAR(255),
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (discount_id) REFERENCES discounts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE SET NULL
);

-- Индексы
CREATE INDEX idx_discount_usage_discount_id ON discount_usage(discount_id);
CREATE INDEX idx_discount_usage_user_id ON discount_usage(user_id);
```

### 🎫 PromoUsage (Использование промокодов)

```sql
CREATE TABLE promo_usage (
  id SERIAL PRIMARY KEY,
  promo_code_id INTEGER NOT NULL,
  user_id BIGINT NOT NULL,
  payment_id VARCHAR(255),
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (promo_code_id) REFERENCES promocodes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE SET NULL
);

-- Индексы
CREATE INDEX idx_promo_usage_promo_id ON promo_usage(promo_code_id);
CREATE INDEX idx_promo_usage_user_id ON promo_usage(user_id);
```

### 🎪 DemoAccess (Демо-доступ)

```sql
CREATE TABLE demo_access (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  channel_id BIGINT NOT NULL,
  product_id INTEGER,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'converted'
  starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  converted_to_payment_id VARCHAR(255),
  granted_by BIGINT, -- Администратор, выдавший доступ
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(channel_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (converted_to_payment_id) REFERENCES payments(payment_id) ON DELETE SET NULL,
  FOREIGN KEY (granted_by) REFERENCES admins(telegram_id) ON DELETE SET NULL
);

-- Индексы
CREATE INDEX idx_demo_access_user_id ON demo_access(user_id);
CREATE INDEX idx_demo_access_channel_id ON demo_access(channel_id);
CREATE INDEX idx_demo_access_status ON demo_access(status);
CREATE INDEX idx_demo_access_expires_at ON demo_access(expires_at);
```

**Описание полей:**
- `status` - Статус демо-доступа
- `converted_to_payment_id` - ID платежа при конверсии
- `granted_by` - Администратор, выдавший доступ
- `notes` - Заметки администратора

### 📢 Broadcasts (Рассылки)

```sql
CREATE TABLE broadcasts (
  broadcast_id VARCHAR(255) PRIMARY KEY,  -- UUID или CUID
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  target_type VARCHAR(50) NOT NULL, -- 'ALL_USERS', 'ACTIVE_SUBSCRIPTIONS', 'EXPIRED_SUBSCRIPTIONS', 'TRIAL_USERS', 'PRODUCT_SPECIFIC', 'CHANNEL_SPECIFIC', 'CUSTOM_FILTER'
  status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'FAILED', 'CANCELLED'
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by) REFERENCES users(telegram_id) ON DELETE SET NULL
);

-- Индексы
CREATE INDEX idx_broadcasts_status ON broadcasts(status);
CREATE INDEX idx_broadcasts_target_type ON broadcasts(target_type);
CREATE INDEX idx_broadcasts_scheduled_at ON broadcasts(scheduled_at);
CREATE INDEX idx_broadcasts_created_by ON broadcasts(created_by);
CREATE INDEX idx_broadcasts_created_at ON broadcasts(created_at);
```

**Описание полей:**
- `broadcast_id` - Уникальный идентификатор рассылки
- `title` - Заголовок рассылки
- `message` - Текст сообщения
- `target_type` - Тип целевой аудитории
- `status` - Статус рассылки
- `total_recipients` - Общее количество получателей
- `sent_count` - Количество отправленных сообщений
- `failed_count` - Количество ошибок при отправке

### 🎯 BroadcastFilters (Фильтры рассылок)

```sql
CREATE TABLE broadcast_filters (
  filter_id VARCHAR(255) PRIMARY KEY,  -- UUID или CUID
  broadcast_id VARCHAR(255) NOT NULL,
  filter_type VARCHAR(50) NOT NULL, -- 'EXCLUDED_USERS', 'PRODUCT_FILTER', 'CHANNEL_FILTER', 'SUBSCRIPTION_STATUS'
  filter_value TEXT NOT NULL, -- JSON строка с параметрами фильтра
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE
);

-- Индексы
CREATE INDEX idx_broadcast_filters_broadcast_id ON broadcast_filters(broadcast_id);
CREATE INDEX idx_broadcast_filters_type ON broadcast_filters(filter_type);
```

**Примеры filter_value:**
```json
// Исключенные пользователи
["123456789", "987654321"]

// Фильтр по продукту
{
  "product_id": 123
}

// Фильтр по каналу
{
  "channel_id": 456
}

// Статус подписки
{
  "status": "active"
}
```

### 📨 BroadcastMessages (Сообщения рассылки)

```sql
CREATE TABLE broadcast_messages (
  message_id VARCHAR(255) PRIMARY KEY,  -- UUID или CUID
  broadcast_id VARCHAR(255) NOT NULL,
  user_id BIGINT NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED'
  sent_at TIMESTAMP,
  error TEXT,
  telegram_message_id INTEGER, -- ID сообщения в Telegram
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Индексы
CREATE INDEX idx_broadcast_messages_broadcast_id ON broadcast_messages(broadcast_id);
CREATE INDEX idx_broadcast_messages_user_id ON broadcast_messages(user_id);
CREATE INDEX idx_broadcast_messages_status ON broadcast_messages(status);
CREATE INDEX idx_broadcast_messages_created_at ON broadcast_messages(created_at);
```

---

## 🔗 Связи и отношения

### 📊 ER Диаграмма основных связей

```
Users (1) -----> (N) Payments
  |
  +-----> (N) Subscriptions
  |
  +-----> (N) DemoAccess

Admins (1) -----> (N) Channels
  |
  +-----> (N) Products
  |
  +-----> (N) Broadcasts

Channels (1) -----> (N) Products
  |
  +-----> (N) Subscriptions
  |
  +-----> (N) DemoAccess

Products (1) -----> (N) Payments
  |
  +-----> (N) Subscriptions

Discounts (1) -----> (N) Promocodes
  |
  +-----> (N) DiscountUsage

Promocodes (1) -----> (N) PromoUsage

Broadcasts (1) -----> (N) BroadcastFilters
  |
  +-----> (N) BroadcastMessages
```

### 🎯 Важные связи

1. **User → Subscriptions** (один ко многим)
   - У пользователя может быть множество подписок
   - Подписка всегда привязана к одному пользователю

2. **Product → Subscriptions** (один ко многим)
   - Один продукт может быть продан множеству раз
   - Каждая подписка привязана к конкретному продукту

3. **Channel → Products** (один ко многим)
   - В одном канале может быть несколько тарифов
   - Каждый продукт привязан к одному каналу

4. **Payment → Subscription** (один к одному)
   - Каждая подписка создается на основе платежа
   - Не все платежи создают подписки (может быть разовая покупка)

---

## 📈 Оптимизация производительности

### 🚀 Индексы для быстрых запросов

```sql
-- Композитные индексы для частых запросов
CREATE INDEX idx_subscriptions_user_active_expires ON subscriptions(user_id, status, expires_at);
CREATE INDEX idx_payments_user_status_date ON payments(user_id, status, created_at);
CREATE INDEX idx_products_channel_active_sort ON products(channel_id, is_active, sort_order);

-- Частичные индексы для оптимизации
CREATE INDEX idx_active_subscriptions_expiring ON subscriptions(expires_at)
WHERE status = 'active' AND expires_at <= NOW() + INTERVAL '7 days';

CREATE INDEX idx_pending_payments_expiring ON payments(expires_at)
WHERE status = 'pending' AND expires_at <= NOW() + INTERVAL '1 hour';
```

### 📊 Оптимизированные запросы

```sql
-- Получение активных подписок пользователя с продуктами
SELECT
  s.*,
  p.name as product_name,
  c.title as channel_title,
  c.username as channel_username
FROM subscriptions s
JOIN products p ON s.product_id = p.id
JOIN channels c ON s.channel_id = c.channel_id
WHERE s.user_id = $1 AND s.status = 'active'
ORDER BY s.expires_at DESC;

-- Статистика платежей за период
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as payments_count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM payments
WHERE status = 'completed'
  AND created_at >= $1 AND created_at <= $2
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date;

-- Поиск истекающих подписок
SELECT
  s.*,
  u.username,
  u.first_name,
  p.name as product_name
FROM subscriptions s
JOIN users u ON s.user_id = u.telegram_id
JOIN products p ON s.product_id = p.id
WHERE s.status = 'active'
  AND s.expires_at <= NOW() + INTERVAL '24 hours'
  AND s.expires_at > NOW();
```

---

## 🔄 Триггеры и процедуры

### ⚡ Автоматическое обновление timestamps

```sql
-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для таблиц
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admins_updated_at BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 📊 Счетчики для статистики

```sql
-- Функция обновления счетчика использования скидок
CREATE OR REPLACE FUNCTION increment_discount_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE discounts
  SET used_count = used_count + 1
  WHERE id = NEW.discount_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER increment_discount_usage_trigger
  AFTER INSERT ON discount_usage
  FOR EACH ROW EXECUTE FUNCTION increment_discount_usage();
```

---

## 📋 Рекомендации по работе с БД

### 🎯 Лучшие практики

1. **Используйте connection pooling** через Prisma
2. **Применяйте prepared statements** для повторяющихся запросов
3. **Оптимизируйте N+1 проблемы** через include в Prisma
4. **Используйте транзакции** для сложных операций
5. **Мониторьте медленные запросы** через EXPLAIN ANALYZE

### 🔧 Резервное копирование

```bash
# Ежедневные бэкапы через pg_dump
pg_dump -h host -U user -d database > backup_$(date +%Y%m%d).sql

# Восстановление из бэкапа
psql -h host -U user -d database < backup_20240101.sql
```

### 📊 Мониторинг производительности

```sql
-- Проверка медленных запросов
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Размер таблиц
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

**🎯 База данных оптимизирована для высокой нагрузки и масштабируемости. Все связи обеспечивают целостность данных, а индексы гарантируют быструю работу даже при миллионах записей.**

[🚀 Развертывание](./deployment.md) | [🔒 Безопасность](./security.md)