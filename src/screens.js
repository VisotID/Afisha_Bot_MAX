// Экраны бота: каждый возвращает { text, attachments }.
// Состояние целиком лежит в payload кнопок — бот не хранит сессий:
//   home                  — выбор города
//   c:<city>              — меню города
//   m:<city>:<page>       — афиша фильмов
//   e:<city>:<page>       — события (концерты, театр, выставки...)

import { Keyboard } from '@maxhub/max-bot-api';
import provider from './provider.js';

const { button } = Keyboard;
const PAGE_SIZE = 4;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const screen = (text, rows) => ({ text, attachments: [Keyboard.inlineKeyboard(rows)] });

async function findCity(cityId) {
  return (await provider.getCities()).find((c) => c.id === cityId);
}

// ── 1. Город ────────────────────────────────────────────────────────────────
export async function citiesScreen() {
  const cities = await provider.getCities();
  const rows = chunk(cities.map((c) => button.callback(c.name, `c:${c.id}`)), 2);
  return screen('🎬 <b>Афиша</b>\n\nВыберите город:', rows);
}

// ── 2. Меню города ──────────────────────────────────────────────────────────
export async function cityMenuScreen(cityId) {
  const city = await findCity(cityId);
  if (!city) return citiesScreen();

  const rows = [
    [button.callback('🎬 Афиша фильмов', `m:${cityId}:0`)],
    [button.callback('🎭 События', `e:${cityId}:0`)],
    [button.link('🌐 Открыть KudaGo', `https://${cityId}.kudago.com/`)],
    [button.callback('⬅️ Другой город', 'home')],
  ];
  return screen(`📍 <b>${esc(city.name)}</b>\n\nЧто смотрим?`, rows);
}

// ── Общий экран списка с пагинацией ─────────────────────────────────────────
async function listScreen({ kind, icon, title, cityId, page, load, describe, emptyHint, altRow }) {
  const city = await findCity(cityId);
  if (!city) return citiesScreen();

  const header = `${icon} <b>${title}</b>\n📍 ${esc(city.name)}\n`;
  const backRow = [
    button.callback('⬅️ В меню города', `c:${cityId}`),
    button.callback('🏠 В начало', 'home'),
  ];

  const items = await load(cityId);

  if (items === null) {
    return screen(`${header}\n⚠️ Сервис афиши временно недоступен, попробуйте позже.`, [backRow]);
  }
  if (items.length === 0) {
    const rows = altRow ? [altRow, backRow] : [backRow];
    return screen(`${header}\n${emptyHint}`, rows);
  }

  const pages = Math.ceil(items.length / PAGE_SIZE);
  const p = Math.min(Math.max(Number(page) || 0, 0), pages - 1);
  const slice = items.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);

  const blocks = slice.map((it) => `${icon} <b>${esc(it.title)}</b>\n${describe(it)}`);
  const paging = pages > 1 ? `\n\nСтраница ${p + 1} из ${pages}` : '';
  const text = `${header}\n${blocks.join('\n\n')}${paging}`;

  // Кнопка-ссылка на страницу мероприятия
  const rows = slice.map((it) => [button.link(`🎟 ${truncate(it.title, 40)}`, it.url)]);

  const nav = [];
  if (p > 0) nav.push(button.callback('◀️ Назад', `${kind}:${cityId}:${p - 1}`));
  if (p < pages - 1) nav.push(button.callback('Ещё ▶️', `${kind}:${cityId}:${p + 1}`));
  if (nav.length) rows.push(nav);
  rows.push(backRow);

  return screen(text, rows);
}

// ── 3. Афиша фильмов ────────────────────────────────────────────────────────
export const moviesScreen = (cityId, page = 0) =>
  listScreen({
    kind: 'm', icon: '🎬', title: 'Афиша фильмов', cityId, page,
    load: (id) => provider.getMovies(id),
    describe: (m) => `${esc(m.genre)} · ${esc(m.age)}`,
    emptyHint: 'Фильмов для этого города не найдено. Загляните в события.',
    altRow: [button.callback('🎭 События', `e:${cityId}:0`)],
  });

// ── 4. События ──────────────────────────────────────────────────────────────
export const eventsScreen = (cityId, page = 0) =>
  listScreen({
    kind: 'e', icon: '🎭', title: 'События', cityId, page,
    load: (id) => provider.getEvents(id),
    describe: (e) => [esc(e.category), e.age && esc(e.age)].filter(Boolean).join(' · '),
    emptyHint: 'Событий на ближайшие дни не найдено.',
  });

// ── Роутер payload → экран ──────────────────────────────────────────────────
export async function route(payload = '') {
  const [kind, cityId, page] = payload.split(':');
  switch (kind) {
    case 'c': return cityMenuScreen(cityId);
    case 'm': return moviesScreen(cityId, page);
    case 'e': return eventsScreen(cityId, page);
    default: return citiesScreen();
  }
}
