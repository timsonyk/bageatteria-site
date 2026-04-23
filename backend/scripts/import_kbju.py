#!/usr/bin/env python3
"""Импорт КБЖУ из csv в БД.

Вход:
  /tmp/kbju_base.csv:          base_norm,size_ml,kcal,prot,fat,carb
  /tmp/kbju_milks.csv:          base_norm,kind,kcal,prot,fat,carb   (дельты, PER-product)
  /tmp/kbju_milk_products.csv:  base_norm                           (какие товары имеют молоко)

База (per-порцию) попадает:
  - в Product.calories/proteins/fats/carbs, если один размер;
  - в ProductSize.*, если несколько (сопоставление по порядку).

Для каждого из 12 кофейных напитков создаётся ОТДЕЛЬНАЯ группа «Тип молока»
с ОПЦИЯМИ, чьи дельты специфичны для ЭТОГО товара (усреднение по 1 продукту
спасает от случаев вида "матча 64 ккал + (-105) = минус").
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

        # === 1. База: Product / ProductSize ===
        groups = {}
        for r in base_rows:
            groups.setdefault(r["base_norm"], []).append(r)

        p_hits, s_hits, misses = 0, 0, []
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

        # === 2. Удаляем старую shared-группу «Тип молока» (если была) ===
        old_groups = (
            db.query(ModificationGroup)
            .filter(ModificationGroup.name == MILK_GROUP_NAME)
            .all()
        )
        for og in old_groups:
            # удаляем связи product ↔ group
            db.query(ModificationGroupProduct).filter(
                ModificationGroupProduct.group_id == og.id
            ).delete(synchronize_session=False)
            # удаляем опции
            db.query(ModificationOption).filter(
                ModificationOption.group_id == og.id
            ).delete(synchronize_session=False)
            db.delete(og)
        db.commit()
        print(f"Старых групп «{MILK_GROUP_NAME}» удалено: {len(old_groups)}")

        # === 3. Per-product «Тип молока» ===
        # kbju_milks.csv имеет колонки base_norm,kind,kcal,prot,fat,carb
        milks_by_product: dict[str, dict[str, dict]] = {}
        for r in milk_rows:
            milks_by_product.setdefault(r["base_norm"], {})[r["kind"]] = r

        created_groups = 0
        for base_norm in milk_product_norms:
            p = by_norm.get(base_norm)
            if not p:
                continue
            deltas = milks_by_product.get(base_norm, {})
            if not deltas:
                continue
            # создаём group
            grp = ModificationGroup(
                name=MILK_GROUP_NAME,
                type="single",
                min_count=1,
                max_count=1,
                sort_order=0,
                is_active=True,
            )
            db.add(grp)
            db.flush()
            # опции
            for idx, kind in enumerate(MILK_OPTIONS_ORDER):
                op = ModificationOption(
                    group_id=grp.id,
                    name=kind,
                    extra_price=0,
                    is_default=(kind == "Обычное"),
                    sort_order=idx,
                    is_active=True,
                )
                if kind == "Обычное":
                    op.calories = 0; op.proteins = 0.0; op.fats = 0.0; op.carbs = 0.0
                elif kind in deltas:
                    d = deltas[kind]
                    op.calories = int(d["kcal"])
                    op.proteins = float(d["prot"])
                    op.fats = float(d["fat"])
                    op.carbs = float(d["carb"])
                db.add(op)
            # привязываем к товару
            db.add(ModificationGroupProduct(group_id=grp.id, product_id=p.id))
            created_groups += 1

        db.commit()
        print(f"Создано per-product групп «Тип молока»: {created_groups}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
