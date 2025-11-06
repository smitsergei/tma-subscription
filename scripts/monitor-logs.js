#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔍 MONITORING TMA-SUBSCRIPTION SYSTEM');
console.log('====================================');

// Check webhook status
console.log('\n1. 🤖 Проверка статуса Telegram бота...');
try {
  const webhookInfo = execSync('curl -s "https://api.telegram.org/bot8570001259:AAGCgENxwN2H15QpwOLyhEG7tN3tB-tl5wM/getWebhookInfo"', { encoding: 'utf8' });
  const webhook = JSON.parse(webhookInfo);
  console.log('   ✅ Бот онлайн');
  console.log('   📍 Webhook URL:', webhook.result.url);
  console.log('   📨 Ожидающих сообщений:', webhook.result.pending_update_count);
} catch (error) {
  console.log('   ❌ Ошибка проверки бота:', error.message);
}

// Check API endpoints
console.log('\n2. 🔌 Проверка API endpoints...');
const endpoints = [
  { name: 'Webhook API', url: 'https://tma-subscription.vercel.app/api/webhook' },
  { name: 'Products API', url: 'https://tma-subscription.vercel.app/api/products' },
  { name: 'Mini App', url: 'https://tma-subscription.vercel.app/app' },
  { name: 'Admin Panel', url: 'https://tma-subscription.vercel.app/admin' }
];

for (const endpoint of endpoints) {
  try {
    execSync(`curl -s -I "${endpoint.url}"`, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`   ✅ ${endpoint.name} - Доступен`);
  } catch (error) {
    console.log(`   ❌ ${endpoint.name} - Недоступен`);
  }
}

// Check database connection via API
console.log('\n3. 🗄️ Проверка подключения к базе данных...');
try {
  const statsResponse = execSync('curl -s "https://tma-subscription.vercel.app/api/admin/stats"', { encoding: 'utf8' });
  const stats = JSON.parse(statsResponse);
  console.log('   ✅ База данных подключена');
  console.log(`   👥 Пользователей: ${stats.totalUsers}`);
  console.log(`   📋 Активных подписок: ${stats.activeSubscriptions}`);
  console.log(`   📦 Продуктов: ${stats.totalProducts}`);
} catch (error) {
  console.log('   ❌ Ошибка подключения к базе данных');
}

console.log('\n🎯 Готово к тестированию!');
console.log('====================================');
console.log('📱 Отправьте команду /start боту в Telegram');
console.log('👑 Проверьте админ-панель');
console.log('📊 Тестируйте все функции');