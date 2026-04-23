#!/usr/bin/env python3
"""Импорт КБЖУ + выравнивание размеров под файл.

Input:
  /tmp/kbju_base.csv:          base_norm,size_ml,kcal,prot,fat,carb (per-порцию)
  /tmp/kbju_milks.csv:          base_norm,kind,kcal_pct,prot_pct,fat_pct,carb_pct
  /tmp/kbju_milk_products.csv:  base_norm (какие товары имеют молоко)

Логика:
 - База (file main rows):
     * Multi-size продукт (>1 main row): обновляет ProductSize.volume и КБЖУ
       по порядку (file 1-й → наш 1-й по sort_order).
     * Single-size (1 main row с size_ml): обновляет Product.weight и КБЖУ.
     * Single-size без size_ml: только КБЖУ.
 - Молоко: для каждого из 12 напитков создаёт ОТДЕЛЬНУЮ группу «Тип молока»,
   опции с *_pct полями (процентная дельта — итог = base × (1+pct/100)).
   Старая shared/per-product группа удаляется.
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

        # === 1. База: выравнивание размеров + КБЖУ ===
        groups_by_base: dict[str, list[dict]] = {}
        for r in base_rows:
            groups_by_base.setdefault(r["base_norm"], []).append(r)

        p_hits, s_hits, size_updates, weight_updates, misses = 0, 0, 0, 0, []
        for base_norm, rows in groups_by_base.items():
            product = by_norm.get(base_norm)
            if not product:
                misses.append(base_norm)
                continue
            rows = sorted(rows, key=lambda r: (r["size_ml"] == "", int(r["size_ml"]) if r["size_ml"] else 0))
            sizes = sorted(product.sizes, key=lambda s: s.sort_order)
            if len(rows) > 1 and sizes:
                # multi-size: обновляем volume + КБЖУ по каждому ProductSize
                for src, dst in zip(rows, sizes):
                    new_vol = f"{src['size_ml']} мл" if src["size_ml"] else dst.volume
                    if new_vol and dst.volume != new_vol:
                        dst.volume = new_vol
                        size_updates += 1
                    dst.calories = int(src["kcal"])
                    dst.proteins = float(src["prot"])
                    dst.fats = float(src["fat"])
                    dst.carbs = float(src["carb"])
                    s_hits += 1
            else:
                # single-size
                r = rows[0]
                if r["size_ml"]:
                    # обновляем Product.weight по файлу
                    new_weight = f"{r['size_ml']} мл"
                    if product.weight != new_weight:
                        product.weight = new_weight
                        weight_updates += 1
                product.calories = int(r["kcal"])
                product.proteins = float(r["prot"])
                product.fats = float(r["fat"])
                product.carbs = float(r["carb"])
                p_hits += 1
        db.commit()
        print(f"Обновлено: Product={p_hits}, ProductSize={s_hits}; volume-правок={size_updates}, weight-правок={weight_updates}")
        if misses:
            print(f"Не сматчились ({len(misses)}):")
            for m in misses:
                print(f"  {m}")

        # === 2. Удаляем старую группу «Тип молока» ===
        old_groups = (
            db.query(ModificationGroup)
            .filter(ModificationGroup.name == MILK_GROUP_NAME)
            .all()
        )
        for og in old_groups:
            db.query(ModificationGroupProduct).filter(
                ModificationGroupProduct.group_id == og.id
            ).delete(synchronize_session=False)
            db.query(ModificationOption).filter(
                ModificationOption.group_id == og.id
            ).delete(synchronize_session=False)
            db.delete(og)
        db.commit()
        print(f"Старых групп «{MILK_GROUP_NAME}» удалено: {len(old_groups)}")

        # === 3. Per-product «Тип молока» с процентными дельтами ===
        milks_by_product: dict[str, dict[str, dict]] = {}
        for r in milk_rows:
            milks_by_product.setdefault(r["base_norm"], {})[r["kind"]] = r

        created = 0
        for base_norm in milk_product_norms:
            p = by_norm.get(base_norm)
            if not p:
                continue
            deltas = milks_by_product.get(base_norm, {})
            if not deltas:
                continue
            grp = ModificationGroup(
                name=MILK_GROUP_NAME, type="single",
                min_count=1, max_count=1, sort_order=0, is_active=True,
            )
            db.add(grp); db.flush()
            for idx, kind in enumerate(MILK_OPTIONS_ORDER):
                op = ModificationOption(
                    group_id=grp.id, name=kind,
                    extra_price=0,
                    is_default=(kind == "Обычное"),
                    sort_order=idx, is_active=True,
                )
                if kind == "Обычное":
                    op.calories_pct = 0.0; op.proteins_pct = 0.0; op.fats_pct = 0.0; op.carbs_pct = 0.0
                elif kind in deltas:
                    d = deltas[kind]
                    op.calories_pct = float(d["kcal_pct"])
                    op.proteins_pct = float(d["prot_pct"])
                    op.fats_pct = float(d["fat_pct"])
                    op.carbs_pct = float(d["carb_pct"])
                db.add(op)
            db.add(ModificationGroupProduct(group_id=grp.id, product_id=p.id))
            created += 1

        db.commit()
        print(f"Создано per-product групп «Тип молока»: {created}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
