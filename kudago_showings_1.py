#!/usr/bin/env python3
"""
Киносеансы с KudaGo через публичный API (kudago.com/public-api/v1.4).
Собирает: город, кинотеатр, фильм, дату и время сеанса -> CSV.

Использование:
    python kudago_showings.py --city spb --days 3 --out showings.csv
    python kudago_showings.py --list-cities
"""
import argparse
import csv
import sys
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests

BASE = "https://kudago.com/public-api/v1.4"
HEADERS = {"User-Agent": "Mozilla/5.0 (educational project)"}
PAUSE = 0.3  # пауза между запросами, чтобы не нагружать сервер


def get(path, **params):
    """GET-запрос к API с простым повтором при ошибках."""
    for attempt in range(3):
        try:
            r = requests.get(f"{BASE}/{path}/", params=params,
                             headers=HEADERS, timeout=20)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            if attempt == 2:
                raise
            print(f"Ошибка {e}, повтор...", file=sys.stderr)
            time.sleep(1.5)


def get_all(path, **params):
    """Проходит по всем страницам результата."""
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


def fetch_showings(city, days):
    # Информация о городе (название и часовой пояс)
    loc = get("locations/" + city, lang="ru")
    city_name = loc["name"]
    tz = ZoneInfo(loc.get("timezone", "Europe/Moscow"))

    now = datetime.now(timezone.utc)
    since = int(now.timestamp())
    until = int((now + timedelta(days=days)).timestamp())

    rows = []
    for s in get_all(
        "movie-showings",
        location=city,
        actual_since=since,
        actual_until=until,
        expand="movie,place",
        fields="id,movie,place,datetime,price,three_d,imax,original_language,site_url",
        order_by="datetime.start",
    ):
        movie = s.get("movie") or {}
        place = s.get("place") or {}
        start = (s.get("datetime") or {}).get("start")
        if start is None:
            continue
        dt = datetime.fromtimestamp(start, tz)
        rows.append({
            "город": city_name,
            "кинотеатр": place.get("title", ""),
            "адрес": place.get("address", ""),
            "фильм": movie.get("title", ""),
            "дата": dt.strftime("%Y-%m-%d"),
            "время": dt.strftime("%H:%M"),
            "цена": s.get("price", ""),
            "3D": s.get("three_d", ""),
            "IMAX": s.get("imax", ""),
            # У самого сеанса отдельной страницы обычно нет, поэтому основная
            # ссылка ведёт на страницу фильма, где перечислены его сеансы.
            "ссылка": s.get("site_url") or movie.get("site_url", ""),
            "ссылка на кинотеатр": place.get("site_url", ""),
        })
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="msk", help="slug города: msk, spb, ...")
    ap.add_argument("--days", type=int, default=2, help="на сколько дней вперёд")
    ap.add_argument("--out", default="showings.csv")
    ap.add_argument("--list-cities", action="store_true")
    args = ap.parse_args()

    if args.list_cities:
        list_cities()
        return

    rows = fetch_showings(args.city, args.days)
    if not rows:
        print("Сеансов не найдено.")
        return

    with open(args.out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys(), delimiter=";")
        w.writeheader()
        w.writerows(rows)

    print(f"Сохранено {len(rows)} сеансов в {args.out}")
    for r in rows[:10]:
        print(r["дата"], r["время"], "|", r["кинотеатр"], "|", r["фильм"],
              "|", r["ссылка"])


if __name__ == "__main__":
    main()
