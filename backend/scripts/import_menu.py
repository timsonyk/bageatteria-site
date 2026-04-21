#!/usr/bin/env python3
"""Импорт каталога меню из prices/*.csv в БД.

Что делает:
  1. Снимает media с существующих товаров (keyed by нормализованное имя).
  2. Удаляет все ProductStoreAvailability / ModificationGroupProduct /
     CategoryRecommendation / Product (ProductSize уходит каскадом).
  3. Создаёт недостающие Category и StoreLocation (депо, смоленка, привоз, зил).
     Лишнее/старое оставляет — не трогает существующие точки кроме легаси-слага
     «privoz» у Смоленской (переименовывает в «smolenka»).
  4. Вставляет Product со всеми связями: size-variants + store availability.
  5. Для каждого товара media подтягивается по нормализованному имени.

Запуск внутри backend-контейнера:
    python scripts/import_menu.py --csv-dir /tmp/prices
"""
from __future__ import annotations

import argparse
import csv
import difflib
import re
from decimal import Decimal
from pathlib import Path

from app.db.session import SessionLocal
from app.models.catalog import (
    Category,
    CategoryRecommendation,
    ModificationGroupProduct,
    Product,
    ProductSize,
    ProductStoreAvailability,
    StoreLocation,
)


def norm_name(s: str | None) -> str:
    if not s:
        return ""
    x = s.strip().casefold().replace("ё", "е")
    x = re.sub(r"[\"'«»„“”()\[\]]", "", x)
    x = x.replace("—", "-").replace("–", "-")
    x = re.sub(r"\s+", " ", x).strip()
    # латинская «a» → кириллическая (нашли у паштель де натa)
    x = x.translate(str.maketrans("aeocxpн", "аеосхрн"))
    return x


LOC_MAP = {
    "депо": {
        "slug": "patriki",
        "name": "Депо",
        "city": "Москва",
        "address_text": "Лесная ул., 20с6",
    },
    "смоленка": {
        "slug": "smolenka",
        "name": "Смоленская",
        "city": "Москва",
        "address_text": "Смоленская пл., 3",
    },
    "привоз": {
        "slug": "privoz",
        "name": "Привоз",
        "city": "Москва",
        "address_text": "Адрес уточняется",
    },
    "зил": {
        "slug": "zil",
        "name": "ЗИЛ",
        "city": "Москва",
        "address_text": "Адрес уточняется",
    },
}

UNIT_MAP = {"МИЛЛИЛИТР": "мл", "ГРАММ": "г", "ШТУКА": "шт"}

# Fallback-медиа для товаров, у которых нормализованное имя изменилось
# между старыми и новыми данными (и потому lookup по нему не срабатывает).
# Файлы физически остались в /app/uploads/.
LEGACY_MEDIA = {
    "капучино": ["/uploads/6ac62e40bd69475fa896bfbdb777cc52.png"],
    "латте": ["/uploads/46c649a68f4149818a814d09feaf4071.png"],
    "раф": ["/uploads/4d0f86206fbc4518abda8621b3c5c23b.png"],
    "айс латте": ["/uploads/ad918c3f9c414ac699a0a483b2909f24.png"],
    "круассан классический": ["/uploads/e4a01d05d1fc484fb9831d5bbc1cb10b.png"],
}


def fmt_qty_unit(qty: str | float | None, unit: str | None) -> str | None:
    """'450.0', 'МИЛЛИЛИТР' → '450 мл'."""
    if qty in (None, "", "nan") or unit in (None, "", "nan"):
        return None
    try:
        q = int(float(qty))
    except (TypeError, ValueError):
        return None
    u = UNIT_MAP.get(str(unit), str(unit))
    return f"{q} {u}"


def ensure_locations(db) -> dict[str, StoreLocation]:
    existing = {s.slug: s for s in db.query(StoreLocation).all()}
    # Легаси: slug='privoz' у Смоленской → переименовать в 'smolenka'
    legacy = existing.get("privoz")
    if legacy and (
        "смоленская" in (legacy.name or "").casefold()
        or "смоленская" in (legacy.address_text or "").casefold()
    ):
        legacy.slug = "smolenka"
        db.flush()
        existing = {s.slug: s for s in db.query(StoreLocation).all()}

    result: dict[str, StoreLocation] = {}
    for label, spec in LOC_MAP.items():
        s = existing.get(spec["slug"])
        if s is None:
            s = StoreLocation(
                slug=spec["slug"],
                name=spec["name"],
                city=spec["city"],
                address_text=spec["address_text"],
                is_active=True,
                sort_order=0,
            )
            db.add(s)
            db.flush()
        else:
            # Аккуратное апдейт — не затирать то что уже корректно
            if not s.name or s.name.strip() == "":
                s.name = spec["name"]
            if not s.address_text or s.address_text.strip() == "":
                s.address_text = spec["address_text"]
        result[label] = s
    db.flush()
    return result


def ensure_categories(db, names: list[str]) -> dict[str, Category]:
    existing = {c.name: c for c in db.query(Category).all()}
    result: dict[str, Category] = {}
    max_sort = max((c.sort_order for c in existing.values()), default=-1)
    for name in names:
        if not name or not name.strip():
            continue
        c = existing.get(name)
        if c is None:
            max_sort += 1
            c = Category(name=name, is_active=True, sort_order=max_sort)
            db.add(c)
            db.flush()
            existing[name] = c
        result[name] = c
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--csv-dir",
        default="/tmp/prices",
        help="Папка с products.csv, sizes.csv, availability.csv",
    )
    args = parser.parse_args()

    csv_dir = Path(args.csv_dir)
    for name in ("products.csv", "sizes.csv", "availability.csv"):
        p = csv_dir / name
        if not p.exists():
            raise FileNotFoundError(f"Нет файла: {p}")

    db = SessionLocal()
    try:
        # --- 1) Сохранить media из БД + hardcoded fallback для ранее утраченных ---
        media_map: dict[str, list] = dict(LEGACY_MEDIA)
        for p in db.query(Product).all():
            key = norm_name(p.name)
            if key and p.media:
                media_map[key] = p.media
        print(f"media пула: {len(media_map)} ключей (из БД + LEGACY_MEDIA)")

        # --- 2) Очистить связанные таблицы и products ---
        deleted_ca = db.query(CategoryRecommendation).delete(synchronize_session=False)
        deleted_av = db.query(ProductStoreAvailability).delete(synchronize_session=False)
        deleted_mg = db.query(ModificationGroupProduct).delete(synchronize_session=False)
        deleted_ps = db.query(ProductSize).delete(synchronize_session=False)
        deleted_p = db.query(Product).delete(synchronize_session=False)
        db.commit()
        print(
            f"Удалено: products={deleted_p}, sizes={deleted_ps}, "
            f"availability={deleted_av}, mod-links={deleted_mg}, cat-recs={deleted_ca}"
        )

        # --- 3) Локации ---
        loc_map = ensure_locations(db)
        db.commit()
        print(
            "Локации: "
            + ", ".join(f"{k}→id={v.id} (slug={v.slug})" for k, v in loc_map.items())
        )

        # --- 4) Читаем csv ---
        with (csv_dir / "products.csv").open(encoding="utf-8") as f:
            products_rows = list(csv.DictReader(f))
        with (csv_dir / "sizes.csv").open(encoding="utf-8") as f:
            sizes_rows = list(csv.DictReader(f))
        with (csv_dir / "availability.csv").open(encoding="utf-8") as f:
            availability_rows = list(csv.DictReader(f))

        sizes_by_canon: dict[str, list[dict]] = {}
        for r in sizes_rows:
            sizes_by_canon.setdefault(r["canonical_name"], []).append(r)

        avail_by_canon: dict[str, list[str]] = {}
        for r in availability_rows:
            avail_by_canon.setdefault(r["canonical_name"], []).append(r["location"])

        # --- 5) Категории ---
        cat_names = sorted({r["category"] for r in products_rows if r["category"]})
        cat_map = ensure_categories(db, cat_names)
        db.commit()
        print(f"Категорий: {len(cat_map)}")

        # --- 6) Товары ---
        inserted = 0
        with_media = 0
        multi_size = 0

        for idx, row in enumerate(products_rows):
            canon = row["canonical_name"]
            display = row["display_name"]
            cat_name = row["category"]
            if not cat_name or cat_name not in cat_map:
                print(f"  пропуск {display!r}: категория {cat_name!r} не найдена")
                continue

            is_multi = row.get("is_multi_size") == "True"
            base_price = Decimal(row["base_price"]) if row["base_price"] else Decimal("0")
            weight = None
            if not is_multi:
                weight = fmt_qty_unit(row.get("base_qty"), row.get("base_unit"))

            media = media_map.get(canon)
            if media is None and media_map:
                # fuzzy-фоллбэк: «капучино» ~ «капуччино», «айс латте» ~ «айс-латте»
                keys = list(media_map.keys())
                matches = difflib.get_close_matches(canon, keys, n=1, cutoff=0.82)
                if matches:
                    media = media_map[matches[0]]
                    print(f"  media fuzzy-match: {canon!r} ← {matches[0]!r}")
            if media:
                with_media += 1

            p = Product(
                category_id=cat_map[cat_name].id,
                name=display,
                description=row.get("description") or None,
                base_price=base_price,
                weight=weight,
                media=media,
                is_active=True,
                sort_order=idx,
            )
            db.add(p)
            db.flush()
            inserted += 1

            if is_multi and canon in sizes_by_canon:
                multi_size += 1
                for sz in sizes_by_canon[canon]:
                    volume = fmt_qty_unit(sz["qty"], sz["unit"])
                    db.add(
                        ProductSize(
                            product_id=p.id,
                            name=sz["size_name"],
                            volume=volume,
                            base_price=Decimal(sz["price"]),
                            sort_order=int(sz["sort_order"]),
                        )
                    )

            for label in avail_by_canon.get(canon, []):
                loc = loc_map.get(label)
                if loc is None:
                    continue
                db.add(
                    ProductStoreAvailability(
                        product_id=p.id, store_location_id=loc.id
                    )
                )

        db.commit()
        print(
            f"Вставлено: {inserted} товаров, multi-size={multi_size}, "
            f"c media={with_media}"
        )

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
