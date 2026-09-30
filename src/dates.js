// Работа с датами в часовом поясе города (а не сервера!)

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isValidISO = (s) => ISO_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Сегодняшняя дата в формате YYYY-MM-DD для заданного часового пояса. */
export function todayISO(tz, now = new Date()) {
  // локаль en-CA форматирует дату как YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

/** Текущее время в городе, в минутах от начала суток. */
export function nowMinutes(tz, now = new Date()) {
  const [h, m] = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(now).split(':').map(Number);
  return h * 60 + m;
}

export const timeToMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Подпись для кнопки: «Сегодня, 19.09», «Завтра, 20.09», «Вс, 21.09»... */
export function shortLabel(iso, offset) {
  const d = new Date(`${iso}T00:00:00Z`);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const base = offset === 0 ? 'Сегодня' : offset === 1 ? 'Завтра'
    : offset === 2 ? 'Послезавтра' : WEEKDAYS[d.getUTCDay()];
  return `${base}, ${dd}.${mm}`;
}

/** «суббота, 19 сентября» */
export function longLabel(iso) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${iso}T00:00:00Z`));
}
