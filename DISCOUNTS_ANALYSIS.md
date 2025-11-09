# АНАЛИЗ РАБОТЫ СКИДОК В СИСТЕМЕ

## ОСНОВНЫЕ НАХОДКИ И СТРУКТУРА СИСТЕМЫ

### 1. Архитектура базы данных

#### Основные таблицы:
- **products** - продукты/подписки с поддержкой скидок
- **discounts** - скидки на продукты
- **promo_codes** - промокоды
- **users** - пользователи
- **subscriptions** - активные подписки
- **payments** - платежи

#### Ключевые поля для скидок:
```typescript
// В таблице products:
interface Product {
  productId: string
  name: string
  price: Decimal        // базовая цена
  discountPrice?: Decimal // цена со скидкой
  isTrial: boolean      // пробный период
  allowDemo: boolean    // доступ к демо
  demoDays: number      // дней демо-доступа
}

// В таблице discounts:
interface Discount {
  id: string
  productId: string
  type: 'PERCENTAGE' | 'FIXED_AMOUNT'
  value: Decimal        // процент или фиксированная сумма
  isActive: boolean
  startDate: DateTime
  endDate: DateTime
}

// В таблице promo_codes:
interface PromoCode {
  id: string
  code: string
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_TRIAL'
  discountValue: Decimal
  productId?: string     // опционально, для конкретных продуктов
  maxUses?: number      // ограничение по использованию
  currentUses: number
  minAmount?: Decimal    // минимальная сумма для использования
  isActive: boolean
  validFrom: DateTime
  validUntil: DateTime
}
```

### 2. API Endpoints для управления скидками

#### Управление продуктами с поддержкой скидок:
- `GET /api/admin/products` - получить все продукты
- `POST /api/admin/products` - создать продукт с полями скидок
- `PUT /api/admin/products` - обновить продукт
- `DELETE /api/admin/products` - удалить продукт

#### Управление скидками:
- `GET /api/admin/discounts` - получить все скидки
- `POST /api/admin/discounts` - создать скидку
- `PUT /api/admin/discounts/[id]` - обновить скидку
- `DELETE /api/admin/discounts/[id]` - удалить скидку

#### Управление промокодами:
- `GET /api/admin/promocodes` - получить все промокоды
- `POST /api/admin/promocodes` - создать промокод
- `PUT /api/admin/promocodes/[id]` - обновить промокод
- `DELETE /api/admin/promocodes/[id]` - удалить промокод

### 3. Виды скидок в системе

#### 3.1 Постоянные скидки (discounts)
- **Процентные скидки**: до 30% на период
- **Фиксированные скидки**: фиксированная сумма в USDT
- **Временные ограничения**: startDate и endDate
- **Ограничение по продуктам**: каждая скидка привязана к продукту

#### 3.2 Промокоды (promo_codes)
- **Типы**: процентные, фиксированные, бесплатный пробный период
- **Глобальные**: применяются ко всем продуктам
- **Продуктовые**: привязаны к конкретным продуктам
- **Ограничения**: maxUses, minAmount
- **Учет использования**: поле currentUses

#### 3.3 Системные скидки
- **Пробный период**: поле isTrial в продукте
- **Демо-доступ**: поле allowDemo и demoDays
- **Скидочная цена**: поле discountPrice в продукте

### 4. Логика применения скидок

#### 4.1 При инициализации платежа
```typescript
// Определение итоговой цены
const finalPrice = product.discountPrice && product.discountPrice < product.price
  ? product.discountPrice
  : product.price

// Проверка активных скидок
const activeDiscount = await prisma.discount.findFirst({
  where: {
    productId,
    isActive: true,
    startDate: { lte: new Date() },
    endDate: { gte: new Date() }
  }
})
```

#### 4.2 Работа с промокодами
```typescript
// Проверка промокода
const promoCode = await prisma.promoCode.findUnique({
  where: { code: code.toUpperCase() }
})

// Проверка условий использования
if (promoCode) {
  if (promoCode.productId && promoCode.productId !== productId) {
    throw new Error('Промокод не применим к этому продукту')
  }
  
  if (promoCode.minAmount && totalPrice < promoCode.minAmount) {
    throw new Error('Минимальная сумма для промокода не достигнута')
  }
  
  if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
    throw new Error('Промокод исчерпал количество использований')
  }
}
```

### 5. Компоненты админ-панели

#### 5.1 Управление продуктами
- `ProductManagement.tsx` - основная панель управления продуктами
- Поддержка редактирования цен со скидками
- Включение/выключение пробных периодов
- Настройка демо-доступа

#### 5.2 Управление скидками
- `DiscountManagement.tsx` - панель управления скидками
- Создание временных скидок
- Выбор типа скидки (процент/фиксированная сумма)
- Настройка периода действия

#### 5.3 Управление промокодами
- `PromoCodeManagement.tsx` - панель управления промокодами
- Генерация промокодов
- Ограничение по использованию
- Привязка к конкретным продуктам

### 6. Особенности реализации

#### 6.1 Обработка BigInt
```typescript
// Безопасная сериализация BigInt для JSON
function safeStringify(obj: any): string {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}
```

#### 6.2 Telegram WebApp интеграция
- Авторизация через initData
- Проверка прав администратора
- Автоматическое создание администраторов

#### 6.3 Безопасность
- Валидация Telegram initData
- Проверка прав доступа
- Обработка ошибок сериализации BigInt

### 7. API для клиентов

#### 7.1 Инициализация платежа
- `/api/payment/initiate` - создание платежа с учетом скидок
- Автоматический расчет finalPrice
- Генерация memo для отслеживания

#### 7.2 Верификация платежа
- `/api/payment/verify` - проверка платежей и создание подписок
- Интеграция с TON blockchain
- Автоматическое добавление в Telegram каналы

### 8. Синхронизация данных

#### 8.1 Каналы и продукты
- Автоматическое создание каналов
- Синхронизация названий каналов между админкой и мини-приложением

#### 8.2 Подписки и платежи
- Автоматическое создание подписок после оплаты
- Отслеживание активных подписок
- Проверка истечения срока

### 9. Отчетность и аналитика

#### 9.1 Статистика
- Количество активных подписок
- Общий доход
- Количество пользователей
- Использование скидок и промокодов

#### 9.2 Логирование
- Детальное логирование операций
- Отправка ошибок в error catcher
- Мониторинг транзакций

### 10. Рекомендации по улучшению

#### 10.1 Безопасность
- Добавить HMAC-SHA256 проверку для initData
- Валидировать все входные данные
- Добавить rate limiting

#### 10.2 Производительность
- Добавить кэширование для часто запрашиваемых данных
- Оптимизировать запросы к базе данных
- Использовать индексы для быстрой фильтрации

#### 10.3 Пользовательский опыт
- Добавить предпросмотр скидок в админ-панели
- Улучшить валидацию форм
- Добавить импорт/экспорт настроек

## ЗАКЛЮЧЕНИЕ

Система скидок в проекте хорошо структурирована и поддерживает три основных типа скидок:
1. Постоянные скидки на продукты
2. Временные скидки с ограничением по периоду
3. Промокоды с различными ограничениями

Все API endpoints корректно обрабатывают BigInt и предоставляют полный функционал для управления скидками через админ-панель.
