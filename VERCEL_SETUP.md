# ⚙️ Vercel Project Settings

## 🔧 **Настройки в Vercel Dashboard:**

### ✅ **Production Settings:**
1. **Auto-Assign Alias**: Включено
2. **Automatic deployments**: Включено для main ветки
3. **Build & Development Settings**:
   - Build Command: `prisma generate && next build`
   - Output Directory: `.next`
   - Install Command: `npm install`
   - Root Directory: `./`

### 🎯 **Domain Settings:**
- **Primary Domain**: `tma-subscription.vercel.app`
- **Custom Domains**: Добавить при необходимости

### 📱 **Environment Variables:**
✅ Все настроены в Production:
- `BOT_TOKEN`
- `TON_WALLET_ADDRESS`
- `TONCENTER_API_KEY`
- `ADMIN_TELEGRAM_ID`
- `NEXT_PUBLIC_APP_URL`

### 🔄 **Git Integration:**
- **Connected Repository**: Ваш GitHub репозиторий
- **Production Branch**: `main`
- **Preview Deployments**: Включены для всех PR

## 📋 **Как проверить настройки:**

1. Откройте [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите проект `tma-subscription`
3. Перейдите в **Settings** → **Git**
4. Убедитесь что "Automatic deployments" включен
5. Проверьте что "Production Branch" = `main`

## 🚀 **Result:**

Теперь каждый `git push main` автоматически:
1. ✅ Деплоит новую версию
2. ✅ Обновит алиас `tma-subscription.vercel.app`
3. ✅ Сохранит только последние deployment'ы
4. ✅ Оставит webhook на том же URL