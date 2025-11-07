# Обновления схемы базы данных для системы скидок

## Новые модели:

### 1. Discount (Скидки)
```sql
model Discount {
  id           String   @id @default(cuid())
  productId    String   @map("product_id")
  type         DiscountType
  value        Decimal  @db.Decimal(10, 2) // Процент или фиксированная сумма
  isActive     Boolean  @default(true) @map("is_active")
  startDate    DateTime @map("start_date")
  endDate      DateTime @map("end_date")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  product      Product @relation(fields: [productId], references: [productId])
  usageHistory DiscountUsage[]

  @@map("discounts")
}
```

### 2. PromoCode (Промокоды)
```sql
model PromoCode {
  id             String     @id @default(cuid())
  code           String     @unique
  type           PromoType
  discountValue  Decimal    @db.Decimal(10, 2)
  productId      String?    @map("product_id") // null = глобальный
  maxUses        Int?       @map("max_uses")
  currentUses    Int        @default(0) @map("current_uses")
  minAmount      Decimal?   @db.Decimal(10, 2) @map("min_amount")
  isActive       Boolean    @default(true) @map("is_active")
  validFrom      DateTime   @map("valid_from")
  validUntil     DateTime   @map("valid_until")
  createdAt      DateTime   @default(now()) @map("created_at")

  product        Product?   @relation(fields: [productId], references: [productId])
  usageHistory   PromoUsage[]

  @@map("promo_codes")
}
```

### 3. DemoAccess (Демо-доступ)
```sql
model DemoAccess {
  id          String   @id @default(cuid())
  userId      BigInt   @map("user_id")
  productId   String   @map("product_id")
  startedAt   DateTime @default(now()) @map("started_at")
  expiresAt   DateTime @map("expires_at")
  isActive    Boolean  @default(true) @map("is_active")

  user        User     @relation(fields: [userId], references: [telegramId])
  product     Product  @relation(fields: [productId], references: [productId])

  @@map("demo_access")
}
```

## Обновления существующих моделей:

### Product (добавить поля)
```sql
model Product {
  // ... существующие поля ...
  discountPrice Decimal? @map("discount_price") @db.Decimal(10, 2) // Уже есть
  isTrial       Boolean  @default(false) @map("is_trial") // Уже есть

  // Новые поля
  allowDemo     Boolean  @default(false) @map("allow_demo")
  demoDays      Int      @default(7) @map("demo_days")

  // Новые связи
  discounts     Discount[]
  promoCodes    PromoCode[]
  demoAccess    DemoAccess[]

  // ... остальное ...
}
```

### User (добавить связь)
```sql
model User {
  // ... существующие поля ...

  // Новая связь
  demoAccess   DemoAccess[]

  // ... остальное ...
}
```

## Перечисления (Enums):

```sql
enum DiscountType {
  PERCENTAGE
  FIXED_AMOUNT
}

enum PromoType {
  PERCENTAGE
  FIXED_AMOUNT
  FREE_TRIAL
}
```

## Таблицы использования:

### DiscountUsage
```sql
model DiscountUsage {
  id         String   @id @default(cuid())
  discountId String   @map("discount_id")
  userId     BigInt   @map("user_id")
  usedAt     DateTime @default(now()) @map("used_at")

  discount   Discount @relation(fields: [discountId], references: [id])
  user       User     @relation(fields: [userId], references: [telegramId])

  @@map("discount_usage")
}
```

### PromoUsage
```sql
model PromoUsage {
  id        String   @id @default(cuid())
  promoId   String   @map("promo_id")
  userId    BigInt   @map("user_id")
  usedAt    DateTime @default(now()) @map("used_at")

  promoCode PromoCode @relation(fields: [promoId], references: [id])
  user      User     @relation(fields: [userId], references: [telegramId])

  @@map("promo_usage")
}
```