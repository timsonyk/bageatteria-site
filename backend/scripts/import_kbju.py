#!/usr/bin/env python3
"""Импорт КБЖУ на 100 г + размеры из csv.

Вход:
  /tmp/kbju_base.csv:            base_norm, sizes_ml, kcal_100, prot_100, fat_100, carb_100
  /tmp/kbju_milks.csv:            base_norm, kind, kcal_100, prot_100, fat_100, carb_100
  /tmp/kbju_milk_products.csv:    base_norm

Логика:
  - Product: пишем calories_per_100g etc. Если sizes_ml один размер — обновляем
    Product.weight + создаём/обновляем единственный ProductSize с volume_ml.
    Если несколько — синхронизируем ProductSize по списку (create/update/delete).
  - Модификация «Тип молока»: создаём для каждого drink с молоком ОТДЕЛЬНУЮ
    группу, опции с calories_per_100g etc (полная замена базы в расчёте).
"""
from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from decimal import Decimal

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
# для матча-напитков base = уже кокосовое
MATCHA_DEFAULT_COCONUT = {"латте матча зеленый", "айс матча латте зеленый"}


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

        # === База: per-100g + размеры ===
        p_hits, s_touched, s_created, misses = 0, 0, 0, []
        for r in base_rows:
            base_norm = r["base_norm"]
            product = by_norm.get(base_norm)
            if not product:
                misses.append(base_norm)
                continue
            product.calories_per_100g = int(float(r["kcal_100"]))
            product.proteins_per_100g = float(r["prot_100"])
            product.fats_per_100g = float(r["fat_100"])
            product.carbs_per_100g = float(r["carb_100"])
            p_hits += 1

            sizes_ml_list = [int(x) for x in r["sizes_ml"].split(";") if x.strip()]
            if not sizes_ml_list:
                # обновим только volume_ml на существующих ProductSize, если есть
                for ps in product.sizes:
                    if ps.volume_ml is None and ps.volume:
                        m = re.search(r"(\d+)", ps.volume)
                        if m:
                            ps.volume_ml = int(m.group(1))
                            s_touched += 1
                continue

            existing = sorted(product.sizes, key=lambda s: s.sort_order)
            # sync: сопоставляем file sizes → DB sizes по sort_order
            if len(sizes_ml_list) == 1 and not existing:
                # single-size без ProductSize — обновляем Product.weight
                product.weight = f"{sizes_ml_list[0]} мл"
                continue

            # multi-size (или single-size с существующим ProductSize)
            for idx, vol_ml in enumerate(sizes_ml_list):
                if idx < len(existing):
                    ps = existing[idx]
                    if ps.volume_ml != vol_ml:
                        ps.volume_ml = vol_ml
                    new_vol = f"{vol_ml} мл"
                    if ps.volume != new_vol:
                        ps.volume = new_vol
                    s_touched += 1
                else:
                    # создаём недостающий размер с дефолтной ценой
                    default_price = existing[0].base_price if existing else Decimal(product.base_price)
                    db.add(ProductSize(
                        product_id=product.id,
                        name=["S","M","L"][min(idx, 2)] + (f"{idx+1}" if idx > 2 else ""),
                        volume=f"{vol_ml} мл",
                        volume_ml=vol_ml,
                        base_price=default_price,
                        sort_order=idx,
                    ))
                    s_created += 1
        db.commit()
        print(f"Product per-100g: {p_hits}. ProductSize: touched={s_touched}, created={s_created}")
        if misses:
            print(f"Не сматчились {len(misses)}: {misses[:10]}{'...' if len(misses)>10 else ''}")

        # === «Тип молока» пересоздание per-product с per-100g ===
        old_groups = db.query(ModificationGroup).filter(ModificationGroup.name == MILK_GROUP_NAME).all()
        for og in old_groups:
            db.query(ModificationGroupProduct).filter(ModificationGroupProduct.group_id == og.id).delete(synchronize_session=False)
            db.query(ModificationOption).filter(ModificationOption.group_id == og.id).delete(synchronize_session=False)
            db.delete(og)
        db.commit()

        milks_by_product: dict[str, dict[str, dict]] = {}
        for r in milk_rows:
            milks_by_product.setdefault(r["base_norm"], {})[r["kind"]] = r

        created = 0
        for base_norm in milk_product_norms:
            p = by_norm.get(base_norm)
            if not p:
                continue
            option_per100 = milks_by_product.get(base_norm, {})
            if not option_per100:
                continue
            grp = ModificationGroup(name=MILK_GROUP_NAME, type="single",
                                    min_count=1, max_count=1, sort_order=0, is_active=True)
            db.add(grp); db.flush()
            coconut_is_default = base_norm in MATCHA_DEFAULT_COCONUT
            for idx, kind in enumerate(MILK_OPTIONS_ORDER):
                is_def = (kind == "Кокосовое") if coconut_is_default else (kind == "Обычное")
                op = ModificationOption(
                    group_id=grp.id, name=kind, extra_price=0,
                    is_default=is_def, sort_order=idx, is_active=True,
                )
                if kind == "Обычное" and not coconut_is_default:
                    # «Обычное» = базовый per-100g Product-а
                    op.calories_per_100g = p.calories_per_100g
                    op.proteins_per_100g = p.proteins_per_100g
                    op.fats_per_100g = p.fats_per_100g
                    op.carbs_per_100g = p.carbs_per_100g
                elif kind in option_per100:
                    src = option_per100[kind]
                    op.calories_per_100g = int(float(src["kcal_100"]))
                    op.proteins_per_100g = float(src["prot_100"])
                    op.fats_per_100g = float(src["fat_100"])
                    op.carbs_per_100g = float(src["carb_100"])
                db.add(op)
            db.add(ModificationGroupProduct(group_id=grp.id, product_id=p.id))
            created += 1
        db.commit()
        print(f"«Тип молока» групп создано: {created}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
