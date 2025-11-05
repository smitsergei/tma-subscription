const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot('8570001259:AAGCgENxwN2H15QpwOLyhEG7tN3tB-tl5wM');

async function getChannelId(channelUsername) {
  try {
    const chat = await bot.getChat(channelUsername);
    console.log(`ID канала @${channelUsername}:`, chat.id);
    return chat.id;
  } catch (error) {
    console.error('Ошибка получения ID канала:', error.message);
  }
}

// Используйте этот скрипт так:
// node get-channel-id.js @your_channel_username
const channelUsername = process.argv[2];

if (channelUsername) {
  getChannelId(channelUsername);
} else {
  console.log('Использование: node get-channel-id.js @channel_username');
}