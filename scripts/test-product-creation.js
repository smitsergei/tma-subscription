#!/usr/bin/env node

// Тестовый скрипт для проверки создания продукта в админ-панели

const testProductCreation = async () => {
  console.log('🧪 ТЕСТИРОВАНИЕ СОЗДАНИЯ ПРОДУКТА');
  console.log('================================');

  // Тестовые данные для продукта
  const testProduct = {
    name: 'Тестовый продукт',
    description: 'Созданный через API тест',
    price: '9.99',
    channelTelegramId: '@testchannel',
    periodDays: '30',
    isActive: true
  };

  try {
    // Симуляция Telegram initData для теста
    const mockTelegramData = 'query_id=AAHdAa0kAAAAAGQGrJCd7m3f&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22Admin%22%2C%22username%22%3A%22testadmin%22%2C%22language_code%22%3A%22ru%22%7D&auth_date=1698000000&hash=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    const response = await fetch('https://tma-subscription.vercel.app/api/admin/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-init-data': mockTelegramData
      },
      body: JSON.stringify(testProduct)
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Продукт успешно создан!');
      console.log('   ID продукта:', result.productId);
      console.log('   Название:', result.name);
      console.log('   Цена:', `$${result.price}`);
      console.log('   Статус:', result.isActive ? 'Активен' : 'Неактивен');
    } else {
      console.log('❌ Ошибка создания продукта:');
      console.log('   Статус:', response.status);
      console.log('   Ошибка:', result.error);
    }
  } catch (error) {
    console.log('❌ Критическая ошибка:', error.message);
  }

  console.log('\n🎯 ГОТОВО!');
  console.log('================================');
};

testProductCreation();