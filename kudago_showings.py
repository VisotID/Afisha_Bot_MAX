#!/usr/bin/env python3
"""
Актуальные фильмы с KudaGo через публичный API (kudago.com/public-api/v1.4).

ВАЖНО:
  * movie-showings у KudaGo больше не отдаёт актуальные сеансы (архив 2019).
  * duration в /movies/ не приходит — KudaGo его не поддерживает в списке.
    Поэтому колонки "длительность" в CSV нет.
  * expand=genres работает ТОЛЬКО вместе с fields.

Собирает: город, фильм, жанры, возраст, ссылка, постер -> CSV.

Использование:
    python kudago_showings.py --city spb --out movies.csv
    python kudago_showings.py --list-cities
"""
import argparse
import csv
import sys
import time

import requests

BASE = "https://kudago.com/public-api/v1.4"
HEADERS = {"User-Agent": "Mozilla/5.0 (educational project)"}
PAUSE = 0.3


def get(path, **params):
    for attempt in range(3):
        try:
            r = requests.get(f"{BASE}/{path}/", params=params,
                             headers=HEADERS, timeout=20)
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError) as e:
            if attempt == 2:
                raise
            print(f"Ошибка {e}, повтор...", file=sys.stderr)
            time.sleep(1.5)


def get_all(path, **params):
    params.setdefault("page_size", 100)
    page = 1
    while True:
        data = get(path, page=page, **params)
        yield from data.get("results", [])
        if not data.get("next"):
            break
        page += 1
        time.sleep(PAUSE)


def list_cities():
    for loc in get("locations", lang="ru"):
        print(f"{loc['slug']:6} {loc['name']}")


def fetch_movies(city):
    loc = get("locations/" + city, lang="ru")
    if isinstance(loc, list):
        loc = loc[0] if loc else {}
    city_name = loc.get("name", city)

    rows = []
    for m in get_all(
        "movies",
        location=city,
        actual=True,
        expand="genres",
        # duration сюда не кладём — KudaGo его не отдаёт в списке
        fields="id,title,slug,genres,age_restriction,poster",
    ):
        genres = ", ".join(g.get("name", "") for g in (m.get("genres") or []))
        poster = ""
        if isinstance(m.get("poster"), dict):
            poster = m["poster"].get("image", "")

        slug_or_id = m.get("slug") or m.get("id")
        rows.append({
            "город": city_name,
            "фильм": m.get("title", ""),
            "жанры": genres,
            "возраст": m.get("age_restriction", ""),
            "ссылка": f"https://{city}.kudago.com/movie/{slug_or_id}/",
            "постер": poster,
        })
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="msk", help="slug города: msk, spb, ...")
    ap.add_argument("--out", default="movies.csv")
    ap.add_argument("--list-cities", action="store_true")
    args = ap.parse_args()

    if args.list_cities:
        list_cities()
        return

    rows = fetch_movies(args.city)
    if not rows:
        print("Фильмов не найдено.")
        return

    with open(args.out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys(), delimiter=";")
        w.writeheader()
        w.writerows(rows)

    print(f"Сохранено {len(rows)} фильмов в {args.out}")
    for r in rows[:10]:
        print(r["фильм"], "|", r["жанры"] or "—", "|",
              r["возраст"] or "—")


if __name__ == "__main__":
    main()