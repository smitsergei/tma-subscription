#!/usr/bin/env node

// Скрипт для обновления webhook через production Vercel CLI

const { execSync } = require('child_process');

console.log('🚀 Updating webhook for production...');

try {
  // Получаем информацию о текущем production deployment
  const deploymentInfo = execSync('vercel ls --scope=smits-projects-3d9ec8f0 --prod', { encoding: 'utf8' });
  console.log('📡 Production deployment info:', deploymentInfo);

  // Вызываем production API endpoint для обновления webhook
  const result = execSync('curl -X POST "https://tma-subscription.vercel.app/api/admin/fix-webhook" -H "Content-Type: application/json"', { encoding: 'utf8' });
  console.log('✅ Webhook update result:', result);

  console.log('✨ Production webhook updated successfully!');
} catch (error) {
  console.error('❌ Failed to update production webhook:', error.message);
  process.exit(1);
}