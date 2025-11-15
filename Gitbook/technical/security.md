# Безопасность системы

## 🛡️ Комплексная защита данных и транзакций

Безопасность — приоритет №1 для системы обработки платежей и персональных данных.

---

## 🎯 Угрозы и модели атак

### 💡 Основные угрозы
- **Фишинг** — подделка интерфейса для кражи данных
- **Man-in-the-Middle** — перехват трафика между клиентом и сервером
- **SQL Injection** — внедрение вредоносного SQL кода
- **XSS (Cross-Site Scripting)** — выполнение вредоносного кода в браузере
- **CSRF (Cross-Site Request Forgery)** — подделка запросов от имени пользователя
- **DDoS атаки** — перегрузка сервера запросами
- **Платежный фрод** — мошенничество с платежами

### 🎯 Атакуемые поверхности
- **API эндпоинты** — основная поверхность атак
- **Telegram Bot API** — вектор атак через Telegram
- **NOWPayments** — интеграция с платежной системой
- **База данных** — хранилище чувствительных данных
- **Админ-панель** — привилегированный доступ

---

## 🔐 Аутентификация и авторизация

### 🤖 Telegram WebApp безопасность

#### ✅ Валидация initData

```typescript
// lib/security/telegram/validation.ts
import crypto from 'crypto';

export function validateTelegramWebApp(initData: string, botToken: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');

    if (!hash) {
      return false;
    }

    // Создаем data-check-string
    const sortedKeys = Array.from(urlParams.keys())
      .filter(key => key !== 'hash')
      .sort();

    const dataCheckString = sortedKeys
      .map(key => `${key}=${urlParams.get(key)}`)
      .join('\n');

    // Создаем секретный ключ
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Вычисляем хеш
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return hash === expectedHash;
  } catch (error) {
    console.error('Telegram validation error:', error);
    return false;
  }
}
```

#### 🕐 Временные проверки

```typescript
// lib/security/telegram/time.ts
export function validateTimestamp(initData: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const authDate = parseInt(urlParams.get('auth_date') || '0');
    const currentTime = Math.floor(Date.now() / 1000);
    const maxAge = 300; // 5 минут

    return (currentTime - authDate) <= maxAge;
  } catch (error) {
    return false;
  }
}
```

### 🎫 JWT безопасность

```typescript
// lib/security/jwt.ts
import jwt from 'jsonwebtoken';

export const jwtConfig = {
  secret: process.env.JWT_SECRET!,
  algorithm: 'HS256',
  expiresIn: '24h',
  issuer: 'tma-subscription',
  audience: 'tma-users'
};

export function generateAdminToken(admin: Admin): string {
  return jwt.sign(
    {
      telegram_id: admin.telegram_id,
      role: admin.role,
      permissions: admin.permissions
    },
    jwtConfig.secret,
    {
      algorithm: jwtConfig.algorithm,
      expiresIn: jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    }
  );
}

export function verifyAdminToken(token: string): any {
  try {
    return jwt.verify(token, jwtConfig.secret, {
      algorithms: [jwtConfig.algorithm],
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience
    });
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
```

---

## 💳 Защита платежной системы

### 🔒 NOWPayments безопасность

#### ✅ Валидация вебхуков

```typescript
// lib/security/nowpayments/webhook.ts
import crypto from 'crypto';

export class WebhookVerifier {
  static verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha512', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  static parseWebhookPayload(payload: string): any {
    try {
      return JSON.parse(payload);
    } catch (error) {
      console.error('Invalid webhook payload:', error);
      return null;
    }
  }
}
```

#### 🛡️ Валидация платежных данных

```typescript
// lib/security/payments/validator.ts
export class PaymentValidator {
  static validatePaymentData(data: any): boolean {
    const required = ['payment_id', 'amount', 'currency', 'payment_status'];

    return required.every(field => data[field] !== undefined && data[field] !== null);
  }

  static validateAmount(amount: number, currency: string): boolean {
    const minAmounts = {
      'USDT': 10,
      'BTC': 0.0001,
      'ETH': 0.01,
      'LTC': 0.01
    };

    return amount >= (minAmounts[currency] || 10);
  }

  static sanitizePaymentId(paymentId: string): string {
    return paymentId.replace(/[^a-zA-Z0-9_-]/g, '');
  }
}
```

### ⏰ Время жизни платежа

```typescript
// lib/security/payments/timeout.ts
export class PaymentTimeout {
  private static readonly PAYMENT_TIMEOUT = 60 * 60 * 1000; // 1 час

  static isExpired(createdAt: Date): boolean {
    const now = Date.now();
    const created = new Date(createdAt).getTime();

    return (now - created) > this.PAYMENT_TIMEOUT;
  }

  static getExpiryDate(): Date {
    return new Date(Date.now() + this.PAYMENT_TIMEOUT);
  }
}
```

---

## 🛡️ Защита API

### 🚦 Rate Limiting

```typescript
// lib/security/rateLimit.ts
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { kv } from '@vercel/kv';

// Настройка Redis store
const redisStore = new RedisStore({
  client: kv,
  prefix: 'rl:'
});

// Общий rate limiting
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 1000, // 1000 запросов с IP
  message: {
    error: 'Too many requests',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore
});

// Строгий rate limiting для платежей
export const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // 5 попыток платежа
  message: {
    error: 'Too many payment attempts',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true,
  store: redisStore
});

// Rate limiting для админ-панели
export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // 100 запросов
  keyGenerator: (req) => {
    // Используем telegram_id вместо IP
    return req.admin?.telegram_id || req.ip;
  },
  store: redisStore
});
```

### 🔍 Валидация входных данных

```typescript
// lib/security/validation.ts
import { z } from 'zod';

// Схемы валидации
export const paymentInitSchema = z.object({
  product_id: z.number().positive().int(),
  promo_code: z.string().optional()
});

export const broadcastSchema = z.object({
  name: z.string().min(1).max(255),
  message: z.string().min(1).max(4096),
  send_type: z.enum(['immediate', 'scheduled']),
  scheduled_at: z.string().datetime().optional(),
  filters: z.array(z.object({
    type: z.string(),
    value: z.string()
  })).optional()
});

// Мидлвэрь для валидации
export function validateRequest(schema: z.ZodSchema) {
  return async (req: Request) => {
    try {
      const body = await req.json();
      const validated = schema.parse(body);
      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.errors
      };
    }
  };
}
```

### 🚫 Защита от инъекций

```typescript
// lib/security/sanitization.ts
export class Sanitizer {
  // Очистка HTML для предотвращения XSS
  static sanitizeHtml(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Валидация SQL параметров
  static validateSqlParam(param: any): boolean {
    if (typeof param === 'string') {
      // Проверка на SQL инъекции
      const sqlInjectionPatterns = [
        /('|(\\')|(;)|(\-\-)|(\s+(or|and)\s+(\w+)?\s*=\s*(\w+)?)/i,
        /(union|select|insert|update|delete|drop|create|alter)/i,
        /(exec|execute|sp_|xp_)/i
      ];

      return !sqlInjectionPatterns.some(pattern => pattern.test(param));
    }

    return true;
  }

  // Очистка имен файлов
  static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9\-_\.]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }
}
```

---

## 🔒 Защита данных

### 🗝️ Шифрование чувствительных данных

```typescript
// lib/security/encryption.ts
import crypto from 'crypto';

export class Encryption {
  private static readonly algorithm = 'aes-256-gcm';
  private static readonly key = crypto.scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);

  // Шифрование данных
  static encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  // Расшифровка данных
  static decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipher(this.algorithm, this.key);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Хеширование паролей и токенов
  static hash(data: string): string {
    return crypto.pbkdf2Sync(data, 'salt', 10000, 64, 'sha512').toString('hex');
  }

  // Генерация безопасных токенов
  static generateToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
```

### 🛡️ Защита PII (Personally Identifiable Information)

```typescript
// lib/security/pseudonymization.ts
export class Pseudonymizer {
  // Маскирование Telegram ID
  static maskTelegramId(telegramId: number): string {
    const idStr = telegramId.toString();
    const visible = idStr.slice(-4);
    const masked = '*'.repeat(idStr.length - 4);
    return masked + visible;
  }

  // Маскирование email
  static maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    const visibleUsername = username.slice(0, 2);
    const maskedUsername = '*'.repeat(username.length - 2);
    return visibleUsername + maskedUsername + '@' + domain;
  }

  // Анонимизация данных для аналитики
  static anonymizeUserData(userData: any): any {
    return {
      telegram_id_hash: this.hash(userData.telegram_id.toString()),
      language_code: userData.language_code,
      created_at: userData.created_at,
      // Исключаем чувствительные данные
    };
  }
}
```

---

## 🔍 Мониторинг безопасности

### 🚨 Детекция аномалий

```typescript
// lib/security/anomalyDetection.ts
export class AnomalyDetector {
  // Детекция аномального количества платежей
  static detectPaymentAnomaly(userId: number, paymentCount: number): boolean {
    const threshold = 10; // Больше 10 платежей за час - подозрительно
    return paymentCount > threshold;
  }

  // Детекция аномальных IP адресов
  static detectSuspiciousActivity(ip: string, requestCount: number): boolean {
    const threshold = 1000; // Больше 1000 запросов за 15 минут
    return requestCount > threshold;
  }

  // Детекция brute force атак
  static detectBruteForce(userId: number, failedAttempts: number): boolean {
    const threshold = 5; // Больше 5 неудачных попыток
    return failedAttempts > threshold;
  }

  // Создание алерта при обнаружении аномалии
  static async createAlert(type: string, details: any): Promise<void> {
    await prisma.securityAlert.create({
      data: {
        type,
        severity: 'high',
        details,
        status: 'open',
        created_at: new Date()
      }
    });

    // Отправка уведомления админам
    await this.notifyAdmins(type, details);
  }
}
```

### 📊 Логирование безопасности

```typescript
// lib/security/logging.ts
export class SecurityLogger {
  private static logLevel = process.env.LOG_LEVEL || 'info';

  static async logSecurityEvent(event: {
    type: string;
    user_id?: number;
    ip_address?: string;
    user_agent?: string;
    details?: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    // Запись в базу данных
    await prisma.securityLog.create({
      data: {
        type: event.type,
        user_id: event.user_id,
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        details: event.details,
        severity: event.severity,
        timestamp: new Date()
      }
    });

    // Отправка в Sentry для критических событий
    if (event.severity === 'critical') {
      Sentry.captureMessage(`Security Event: ${event.type}`, {
        level: 'error',
        extra: event
      });
    }

    // Логирование в консоль для разработки
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SECURITY] ${event.type}:`, event);
    }
  }

  // Попытка входа
  static async logLoginAttempt(user_id: number, success: boolean, ip: string): Promise<void> {
    await this.logSecurityEvent({
      type: success ? 'login_success' : 'login_failed',
      user_id,
      ip_address: ip,
      severity: success ? 'low' : 'medium'
    });
  }

  // Подозрительная транзакция
  static async logSuspiciousTransaction(payment_id: string, reason: string): Promise<void> {
    await this.logSecurityEvent({
      type: 'suspicious_transaction',
      details: { payment_id, reason },
      severity: 'high'
    });
  }
}
```

---

## 🛠️ Безопасная конфигурация

### 🔧 Конфигурация заголовков безопасности

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https://api.telegram.org https://api.nowpayments.io",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  }
];

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders
      }
    ];
  }
};
```

### 🔐 Переменные окружения и секреты

```typescript
// lib/config/security.ts
export const securityConfig = {
  // Валидация секретов
  validateSecrets: () => {
    const requiredSecrets = [
      'BOT_TOKEN',
      'BOT_SECRET',
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'NOWPAYMENTS_API_KEY'
    ];

    const missing = requiredSecrets.filter(secret => !process.env[secret]);

    if (missing.length > 0) {
      throw new Error(`Missing required secrets: ${missing.join(', ')}`);
    }
  },

  // Валидация силы паролей/секретов
  validateSecretStrength: (secret: string, name: string): boolean => {
    if (name === 'JWT_SECRET' || name === 'ENCRYPTION_KEY') {
      return secret.length >= 32;
    }

    if (name === 'BOT_TOKEN') {
      return secret.match(/^\d+:[a-zA-Z0-9_-]+$/) !== null;
    }

    return secret.length > 0;
  }
};
```

---

## 🔄 Обновления и патчи

### 📦 Автоматические обновления безопасности

```json
// package.json
{
  "scripts": {
    "security:audit": "npm audit",
    "security:fix": "npm audit fix",
    "deps:update": "npm update",
    "deps:check": "npm outdated"
  },
  "dependencies": {
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3"
  }
}
```

### 🎯 Процедура обновления

```bash
#!/bin/bash
# scripts/security-update.sh

echo "🔒 Checking for security updates..."

# Проверка уязвимостей
npm audit --audit-level=moderate

# Обновление пакетов
npm update

# Обновление Prisma
npx prisma generate

# Запуск тестов
npm test

# Деплой в продакшн
vercel --prod

echo "✅ Security update completed!"
```

---

## 📋 Чек-лист безопасности

### ✅ Критические проверки

- [ ] **Все переменные окружения** настроены и проверены
- [ ] **Telegram WebApp валидация** работает корректно
- [ ] **JWT токены** имеют правильную конфигурацию
- [ ] **SSL/TLS** настроен и работает
- [ ] **Security headers** установлены
- [ ] **Rate limiting** настроен для всех эндпоинтов
- [ ] **Валидация входных данных** реализована
- [ ] **Шифрование** чувствительных данных настроено
- [ ] **Логирование безопасности** работает
- [ ] **Мониторинг** аномалий настроен

### 🛡️ Регулярные проверки (ежемесячно)

- [ ] **Аудит зависимостей** на уязвимости
- [ ] **Проверка логов** безопасности
- [ ] **Тестирование** rate limiting
- [ ] **Обновление** пакетов безопасности
- [ ] **Ревью** прав доступа администраторов
- [ ] **Проверка** бэкапов и восстановления
- [ ] **Тестирование** восстановления после сбоя

### 🎯 Периодические проверки (ежеквартально)

- [ ] **Пентестинг** системы безопасности
- [ ] **Аудит кода** на уязвимости
- [ ] **Проверка** соответствия GDPR/CCPA
- [ ] **Обновление** документации безопасности
- [ ] **Обучение** команды безопасности

---

## 🚨 План реагирования на инциденты

### 📞 Контакты и эскалация

```typescript
// lib/security/incidentResponse.ts
export const incidentResponsePlan = {
  // Критичность уровня
  severity: {
    critical: {
      responseTime: '15 минут',
      escalation: ['CTO', 'Security Lead', 'CEO'],
      communication: ['Все пользователи', 'Команда']
    },
    high: {
      responseTime: '1 час',
      escalation: ['Security Lead', 'CTO'],
      communication: ['Затронутые пользователи']
    },
    medium: {
      responseTime: '4 часа',
      escalation: ['Security Lead'],
      communication: ['Внутренняя команда']
    },
    low: {
      responseTime: '24 часа',
      escalation: ['Security Lead'],
      communication: ['Нет']
    }
  },

  // Шаблоны коммуникации
  templates: {
    incidentNotification: "🚨 Мы обнаружили проблему с безопасностью и работаем над её решением.",
    resolutionNotification: "✅ Проблема с безопасностью устранена. Все сервисы работают в штатном режиме."
  }
};
```

---

**🛡️ Безопасность — это непрерывный процесс, а не разовая настройка. Регулярные аудиты и обновления обеспечивают защиту ваших данных и данных пользователей.**

[🛠️ Устранение проблем](./troubleshooting.md) | [📊 API справочник](./api-reference.md)