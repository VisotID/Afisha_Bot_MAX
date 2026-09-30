import { citiesScreen, route } from './screens.js';

const show = (title, s) => {
  console.log(`\n===== ${title} =====\n${s.text}`);
  const rows = s.attachments[0].payload.buttons;
  for (const row of rows) {
    console.log('  [' + row.map((b) => `${b.text} → ${b.payload ?? b.url}`).join(' | ') + ']');
  }
};

show('Города', await citiesScreen());
show('Меню города (spb)', await route('c:spb'));
show('Фильмы, стр. 1', await route('m:spb:0'));
show('Фильмы, стр. 2', await route('m:spb:1'));
show('Мусорный payload', await route('m:xxx:zzz'));