#!/usr/bin/env node

const { execSync } = require('child_process');
const https = require('https');
const querystring = require('querystring');

// Получаем URL текущего deployment
const deploymentUrl = process.argv[2];
if (!deploymentUrl) {
  console.error('❌ Deployment URL not provided');
  process.exit(1);
}

console.log('🚀 Starting post-deploy setup...');
console.log(`📡 Deployment URL: ${deploymentUrl}`);

// Функция для обновления webhook
async function updateWebhook() {
  return new Promise((resolve, reject) => {
    const webhookUrl = `${deploymentUrl}/api/webhook`;
    const botToken = process.env.BOT_TOKEN;

    if (!botToken) {
      console.error('❌ BOT_TOKEN not found in environment');
      reject(new Error('BOT_TOKEN missing'));
      return;
    }

    const postData = JSON.stringify({
      url: webhookUrl,
      drop_pending_updates: true
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/setWebhook`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        if (result.ok) {
          console.log('✅ Webhook updated successfully:', webhookUrl);
          resolve(result);
        } else {
          console.error('❌ Webhook update failed:', result);
          reject(new Error(result.description));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Webhook request error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Функция для отправки уведомления в Telegram
async function sendNotification() {
  return new Promise((resolve, reject) => {
    const botToken = process.env.BOT_TOKEN;
    const adminId = process.env.ADMIN_TELEGRAM_ID;

    if (!botToken || !adminId) {
      console.log('⚠️  Skipping notification - missing credentials');
      resolve();
      return;
    }

    const message = `🎉 *Deployment Successful*

📡 *New deployment is live*: ${deploymentUrl}
🔗 *Admin Panel*: ${deploymentUrl}/admin
🤖 *Webhook*: Updated automatically

✨ All systems are ready for testing!`;

    const postData = JSON.stringify({
      chat_id: adminId,
      text: message,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🚀 Открыть админ-панель',
            web_app: {
              url: `${deploymentUrl}/admin`
            }
          },
          {
            text: '📱 Открыть Mini App',
            web_app: {
              url: `${deploymentUrl}`
            }
          }
        ]]
      }
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const result = JSON.parse(data);
        if (result.ok) {
          console.log('✅ Notification sent successfully');
          resolve(result);
        } else {
          console.error('❌ Notification failed:', result);
          reject(new Error(result.description));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Notification request error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Основная функция
async function main() {
  try {
    console.log('🔧 Updating webhook...');
    await updateWebhook();

    console.log('📱 Sending notification...');
    await sendNotification();

    console.log('✨ Post-deploy setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Post-deploy setup failed:', error.message);
    process.exit(1);
  }
}

main();