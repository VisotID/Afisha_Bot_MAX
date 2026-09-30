import 'dotenv/config';
import { Bot } from '@maxhub/max-bot-api';
import { citiesScreen, route } from './screens.js';

if (!process.env.BOT_TOKEN) {
  console.error('Не задан BOT_TOKEN (см. .env.example)');
  process.exit(1);
}

const bot = new Bot(process.env.BOT_TOKEN);
const FORMAT = 'html';

bot.api.setMyCommands([{ name: 'start', description: 'Открыть афишу' }]).catch(console.error);

// Оборачиваем обработчики, чтобы одна ошибка не роняла бота
const safe = (fn) => async (ctx) => {
  try {
    await fn(ctx);
  } catch (err) {
    console.error('Handler error:', err);
    try {
      if (getCallback(ctx)) await ctx.answerOnCallback({ notification: 'Что-то пошло не так, попробуйте ещё раз' });
    } catch { /* ignore */ }
  }
};

const getCallback = (ctx) => ctx.callback ?? ctx.update?.callback ?? null;

const sendHome = async (ctx) => {
  const { text, attachments } = await citiesScreen();
  await ctx.reply(text, { attachments, format: FORMAT });
};

// Пользователь нажал «Начать» / написал /start / написал что угодно — показываем выбор города
bot.on('bot_started', safe(sendHome));
bot.command('start', safe(sendHome));

// Нажатие inline-кнопки: заменяем текущее сообщение новым экраном (без «простыни» в чате)
bot.on('message_callback', safe(async (ctx) => {
  const payload = getCallback(ctx)?.payload ?? '';
  const { text, attachments } = await route(payload);
  await ctx.answerOnCallback({ message: { text, attachments, format: FORMAT } });
}));

// Любой другой текст
bot.on('message_created', safe(sendHome));

bot.start();
console.log('Бот-афиша запущен');
