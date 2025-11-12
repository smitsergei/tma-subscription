// Простой тест для проверки работы бота
// Запустить: node test-bot-messaging.js

require('dotenv').config({ path: '.env.local' });

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

async function testBotAPI() {
  console.log('🤖 Тестирование Telegram Bot API...');

  try {
    // 1. Проверяем информацию о боте
    console.log('\n1. Проверка информации о боте...');
    const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const botData = await botInfo.json();

    if (botData.ok) {
      console.log('✅ Бот найден:', botData.result.username);
      console.log('   Имя:', botData.result.first_name);
      console.log('   ID:', botData.result.id);
    } else {
      console.error('❌ Ошибка получения информации о боте:', botData);
      return;
    }

    // 2. Тестовая отправка сообщения (замените на реальный ID пользователя)
    const testUserId = '534704558'; // Замените на ID пользователя для теста

    console.log(`\n2. Тестовая отправка сообщения пользователю ${testUserId}...`);

    const messageResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: parseInt(testUserId),
        text: `🧪 Тестовое сообщение от системы\n\nВремя: ${new Date().toLocaleString('ru-RU')}\n\nЕсли вы это видите, бот работает корректно!`,
        parse_mode: 'HTML'
      })
    });

    const messageData = await messageResponse.json();

    console.log('Ответ Telegram API:', messageData);

    if (messageData.ok) {
      console.log('✅ Сообщение успешно отправлено!');
      console.log('   Message ID:', messageData.result.message_id);
    } else {
      console.error('❌ Ошибка отправки сообщения:', messageData);

      if (messageData.error_code === 403) {
        console.log('\n🔍 Возможные причины ошибки 403:');
        console.log('   - Пользователь заблокировал бота');
        console.log('   - Пользователь отключил сообщения от ботов в настройках приватности');
        console.log('   - Неверный ID пользователя');
        console.log('   - Бот не имеет права отправлять сообщения этому пользователю');
      }
    }

  } catch (error) {
    console.error('❌ Ошибка при выполнении запроса:', error);
  }
}

testBotAPI();