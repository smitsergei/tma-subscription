# Настройка GitHub Actions для обхода ограничения Vercel

## Что настроено

Создан универсальный эндпоинт `/api/cron/github-check` для GitHub Actions и два workflow:

1. **hourly-cron.yml** - запускается каждый час автоматически
2. **cron-checks.yml** - для запуска вручную с выбором конкретной проверки

## Переменные окружения

Добавьте в GitHub repository settings → Secrets and variables → Actions:

### Обязательные:

1. **`APP_URL`** - URL вашего приложения в Vercel
   ```
   https://your-app.vercel.app
   ```

2. **`GITHUB_ACTIONS_SECRET`** - Секретный ключ для защиты API эндпоинта
   ```
   Сгенерируйте случайную строку, например: github-abc123def456
   ```

### Установка в Vercel:

Добавьте в Vercel Environment Variables:

1. **`GITHUB_ACTIONS_SECRET`** - такой же как в GitHub Secrets
   ```
   github-abc123def456
   ```

2. **`CRON_SECRET`** - секрет для существующих cron эндпоинтов
   ```
   Сгенерируйте другую случайную строку
   ```

## Как это работает

1. GitHub Actions каждый час вызывает `/api/cron/github-check`
2. Эндпоинт проверяет `GITHUB_ACTIONS_SECRET` в заголовке Authorization
3. Если авторизация прошла, запускаются все проверки:
   - `/api/cron/check-subscriptions` - проверка истекших подписок
   - `/api/cron/check-demo-access` - проверка демо-доступа
   - `/api/cron/scheduled-broadcasts` - запланированные рассылки
4. Каждая проверка использует `CRON_SECRET` для авторизации
5. Результаты логируются и возвращаются в GitHub Actions

## Проверка работы

### Запуск вручную:
1. Перейдите в GitHub → Actions
2. Выберите "Hourly Cron Checks" или "Individual Cron Checks"
3. Нажмите "Run workflow"

### Проверка эндпоинта напрямую:
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_GITHUB_SECRET" \
  YOUR_APP_URL/api/cron/github-check
```

## Лимиты GitHub Actions

- **2000 минут** в месяц бесплатно
- Ежечасный запуск = ~24 минуты в сутки = ~720 минут в месяц
- Останется ~1280 минут для других задач

## Мониторинг

Все логи доступны в:
- GitHub Actions workflow runs
- Vercel function logs
- Ваше приложение console.log

Лимит Vercel Hobby (1 запуск в сутки) больше не применяется, так как триггер - внешний (GitHub Actions).