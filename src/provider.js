// src/provider.js

const BASE_URL = 'https://kudago.com/public-api/v1.4';
const TTL = 30 * 60_000;        // кэш афиши: 30 минут
const TIMEOUT = 8000;           // таймаут запроса, мс
const EVENTS_DAYS = 14;         // события на ближайшие N дней

// Города фиксированы: не зависим от API, и на клик не нужен сетевой запрос.
const CITIES = [
  { id: 'msk', name: 'Москва', tz: 'Europe/Moscow' },
];

const CATEGORY_LABELS = {
  concert: 'Концерт',
  theater: 'Театр',
  exhibition: 'Выставка',
  festival: 'Фестиваль',
  kids: 'Детям',
  party: 'Вечеринка',
  education: 'Обучение',
  entertainment: 'Развлечения',
  cinema: 'Кино',
  quest: 'Квест',
  stock: 'Акция',
  'stand-up': 'Стендап',
  yarmarki: 'Ярмарка',
  tour: 'Экскурсия',
};

function safeUrl(raw, fallback) {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
  }
  return fallback;
}

const cache = new Map();

// Кэш с запасом: если API упал, отдаём устаревшие данные, если они есть.
async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  try {
    const data = await loader();
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch (err) {
    if (hit) return hit.data;
    throw err;
  }
}

function formatAge(a) {
  if (a === null || a === undefined || a === '') return '';
  const s = String(a);
  return s.includes('+') ? s : `${s}+`;
}

class KudaGoProvider {
  async _fetch(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v);

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT) });
    if (!response.ok) {
      throw new Error(`KudaGo API Error: ${response.status} ${response.statusText}`);
    }
    const json = await response.json();
    if (json && Array.isArray(json.results)) return json.results;
    return json;
  }

  async getCities() {
    return CITIES;
  }

  // ── Фильмы ───────────────────────────────────────────────────────────────
  // Возвращает массив (может быть пустым) или null, если API недоступен.
  async getMovies(cityId) {
    try {
      return await cached(`movies:${cityId}`, async () => {
        const movies = await this._fetch('/movies/', {
          location: cityId,
          actual: 'true',
          expand: 'genres',
          fields: 'id,title,genres,age_restriction,site_url',
          page_size: 100,
        });
        if (!Array.isArray(movies)) return [];
        return movies.map((m) => ({
          id: m.id,
          title: m.title,
          genre: (m.genres || []).map((g) => g.name).join(', ') || 'Жанр не указан',
          age: formatAge(m.age_restriction) || '0+',
          url: safeUrl(
            m.site_url,
            `https://${cityId}.kudago.com/search/?q=${encodeURIComponent(m.title)}`,
          ),
        }));
      });
    } catch (error) {
      console.error(`Ошибка в getMovies(${cityId}):`, error.cause?.code ?? error.message);
      return null;
    }
  }

  // ── События (концерты, спектакли, выставки...) ───────────────────────────
  async getEvents(cityId) {
    try {
      return await cached(`events:${cityId}`, async () => {
        const since = Math.floor(Date.now() / 1000);
        const events = await this._fetch('/events/', {
          location: cityId,
          actual_since: since,
          actual_until: since + EVENTS_DAYS * 86400,
          fields: 'id,title,site_url,categories,age_restriction',
          page_size: 100,
        });
        if (!Array.isArray(events)) return [];
        return events
          .filter((e) => e && e.title)
          .map((e) => {
            const cat = (e.categories || []).find((c) => CATEGORY_LABELS[c]);
            return {
              id: e.id,
              title: e.title,
              category: cat ? CATEGORY_LABELS[cat] : 'Событие',
              age: formatAge(e.age_restriction),
              url: safeUrl(
                e.site_url,
                `https://${cityId}.kudago.com/search/?q=${encodeURIComponent(e.title)}`,
              ),
            };
          });
      });
    } catch (error) {
      console.error(`Ошибка в getEvents(${cityId}):`, error.cause?.code ?? error.message);
      return null;
    }
  }
}

export default new KudaGoProvider();
