#!/usr/bin/env python3
"""Импорт КБЖУ из csv в БД.

Вход:
  /tmp/kbju_base.csv:   base_norm,size_ml,kcal,prot,fat,carb
  /tmp/kbju_milks.csv:  kind,kcal,prot,fat,carb   (дельты)
  /tmp/kbju_milk_products.csv: base_norm         (товары, к которым крепим «Тип молока»)

База (per-порцию) попадает:
  - в Product.calories/proteins/fats/carbs, если один размер;
  - в ProductSize.*, если несколько (сопоставление по порядку).

Создаёт/обновляет группу «Тип молока» с опциями:
  Обычное (default, delta=0), Кокосовое, Миндальное, Банановое, Фундучное, Овсяное.
"""
from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

from app.db.session import SessionLocal
from app.models.catalog import (
    ModificationGroup,
    ModificationOption,
    ModificationGroupProduct,
    Product,
    ProductSize,
)


def norm_name(s):
    if not s:
        return ""
    x = s.strip().casefold().replace("ё", "е")
    x = re.sub(r"[\"'«»„“”()\[\]]", "", x)
    x = x.replace("—", "-").replace("–", "-")
    x = re.sub(r"\s+", " ", x).strip()
    return x


MILK_GROUP_NAME = "Тип молока"
MILK_OPTIONS_ORDER = ["Обычное", "Кокосовое", "Миндальное", "Банановое", "Фундучное", "Овсяное"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dir", default="/tmp")
    args = parser.parse_args()
    d = Path(args.dir)

    with (d / "kbju_base.csv").open(encoding="utf-8") as f:
        base_rows = list(csv.DictReader(f))
    with (d / "kbju_milks.csv").open(encoding="utf-8") as f:
        milk_rows = list(csv.DictReader(f))
    with (d / "kbju_milk_products.csv").open(encoding="utf-8") as f:
        milk_product_norms = [r["base_norm"] for r in csv.DictReader(f)]

    db = SessionLocal()
    try:
        all_products = db.query(Product).all()
        by_norm = {norm_name(p.name): p for p in all_products}

        # Группируем base rows по base_norm
        groups = {}
        for r in base_rows:
            groups.setdefault(r["base_norm"], []).append(r)

        p_hits, s_hits = 0, 0
        misses = []
        for base_norm, rows in groups.items():
            product = by_norm.get(base_norm)
            if not product:
                misses.append(base_norm)
                continue
            rows = sorted(rows, key=lambda r: (r["size_ml"] == "", int(r["size_ml"]) if r["size_ml"] else 0))
            sizes = sorted(product.sizes, key=lambda s: s.sort_order)
            if len(rows) > 1 and sizes:
                for src, dst in zip(rows, sizes):
                    dst.calories = int(src["kcal"])
                    dst.proteins = float(src["prot"])
                    dst.fats = float(src["fat"])
                    dst.carbs = float(src["carb"])
                    s_hits += 1
            else:
                r = rows[0]
                product.calories = int(r["kcal"])
                product.proteins = float(r["prot"])
                product.fats = float(r["fat"])
                product.carbs = float(r["carb"])
                p_hits += 1
        db.commit()
        print(f"Обновлено: Product={p_hits}, ProductSize={s_hits}")
        if misses:
            print(f"Не сматчились ({len(misses)}):")
            for m in misses:
                print(f"  {m}")

        # группа «Тип молока»
        grp = (
            db.query(ModificationGroup)
            .filter(ModificationGroup.name == MILK_GROUP_NAME)
            .first()
        )
        if not grp:
            grp = ModificationGroup(
                name=MILK_GROUP_NAME, type="single",
                min_count=1, max_count=1, sort_order=0, is_active=True,
            )
            db.add(grp)
            db.flush()

        milk_map = {r["kind"]: r for r in milk_rows}
        for idx, kind in enumerate(MILK_OPTIONS_ORDER):
            op = (
                db.query(ModificationOption)
                .filter(ModificationOption.group_id == grp.id, ModificationOption.name == kind)
                .first()
            )
            if not op:
                op = ModificationOption(
                    group_id=grp.id, name=kind,
                    extra_price=0,
                    is_default=(kind == "Обычное"),
                    sort_order=idx, is_active=True,
                )
                db.add(op)
                db.flush()
            op.is_default = (kind == "Обычное")
            op.sort_order = idx
            if kind == "Обычное":
                op.calories = 0; op.proteins = 0.0; op.fats = 0.0; op.carbs = 0.0
            else:
                src = milk_map.get(kind)
                if src:
                    op.calories = int(src["kcal"])
                    op.proteins = float(src["prot"])
                    op.fats = float(src["fat"])
                    op.carbs = float(src["carb"])

        # прикрепляем к продуктам
        existing_links = {
            (l.group_id, l.product_id)
            for l in db.query(ModificationGroupProduct).all()
        }
        attached = 0
        for bn in milk_product_norms:
            p = by_norm.get(bn)
            if not p:
                continue
            if (grp.id, p.id) not in existing_links:
                db.add(ModificationGroupProduct(group_id=grp.id, product_id=p.id))
                attached += 1
        db.commit()
        print(f"«Тип молока»: опций {len(MILK_OPTIONS_ORDER)}, прикреплено к {attached} товарам")

    finally:
        db.close()


if __name__ == "__main__":
    main()
