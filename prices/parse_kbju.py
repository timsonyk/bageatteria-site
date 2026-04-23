"""Парсит KBJU xlsx → 2 CSV:
 base.csv:  base_norm, size_ml, kcal, prot, fat, carb
 milks.csv: base_norm, kind, kcal_pct, prot_pct, fat_pct, carb_pct
     pct — процентная дельта: итог = base × (1 + pct/100).
"""
import csv
import re
from pathlib import Path

import pandas as pd

HERE = Path(__file__).parent
SRC = Path("/tmp/kbju.xlsx")
SHEET = "КБЖУ напитков"

NAME_MAP_NORM = {
    "флэт уайт": "флэт уайт",
    "айс латте": "айс латте",
    "айс матча латте": "айс матча латте зеленый",
    "матча латте": "латте матча зеленый",
    "матча тоник": "матча тоник",
    "горячий шоколад": "горячий шоколад",
    "раф урбеч": "раф урбеч",
    "фраппе урбеч": "фраппе урбеч",
    "лимонад манго маракуйя": "лимонад манго-маракуйя",
    "лимонад малина базилик": "лимонад малина-базилик",
    "апероль б\\а": "апероль безалкогольный",
}


def norm_name(s):
    if not s: return ""
    x = s.strip().casefold().replace("ё","е")
    x = re.sub(r"[\"'«»„“”()\[\]]","",x)
    x = x.replace("—","-").replace("–","-")
    x = re.sub(r"\s+"," ",x).strip()
    return x


MILK_KIND_MAP = {
    "кокосовом молоке": "Кокосовое",
    "миндальном молоке": "Миндальное",
    "банановом молоке": "Банановое",
    "фундучном молоке": "Фундучное",
    "овсяном": "Овсяное",
    "овсяном молоке": "Овсяное",
}


def main():
    df = pd.read_excel(SRC, sheet_name=SHEET, header=None)
    base_rows = []
    # milk-subvariants привязаны к конкретной main-строке: храним как (base_norm, size_ml, kind)
    milks_by_base_size: dict[tuple[str, int | None], dict[str, dict]] = {}
    current_base = None
    current_size = None

    for i in range(5, len(df)):
        name = df.iloc[i, 0]
        if pd.isna(name): continue
        name = str(name).strip()
        fat = df.iloc[i, 5]; prot = df.iloc[i, 6]; carb = df.iloc[i, 7]; kcal = df.iloc[i, 8]
        if pd.isna(kcal): continue

        if name.startswith("-"):
            raw = re.sub(r"^-\s*", "", name).strip()
            raw = re.sub(r"^на\s+", "", raw, flags=re.IGNORECASE).strip()
            kind = MILK_KIND_MAP.get(raw.casefold())
            if not kind or current_base is None:
                continue
            key = (current_base, current_size)
            milks_by_base_size.setdefault(key, {})[kind] = {
                "kcal": int(round(kcal)),
                "prot": float(prot or 0),
                "fat": float(fat or 0),
                "carb": float(carb or 0),
            }
            continue

        m = re.match(r"^(.+?)\s+(\d+)\s*(мл|г|гр)\.?\s*$", name, flags=re.IGNORECASE)
        if m:
            base = m.group(1).strip()
            size_ml = int(m.group(2))
        else:
            base = name
            size_ml = None
        base_norm = NAME_MAP_NORM.get(norm_name(base), norm_name(base))
        current_base = base_norm
        current_size = size_ml

        base_rows.append({
            "base_norm": base_norm, "size_ml": size_ml,
            "kcal": int(round(kcal)),
            "prot": round(float(prot or 0), 2),
            "fat": round(float(fat or 0), 2),
            "carb": round(float(carb or 0), 2),
        })

    with (HERE/"kbju_base.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["base_norm","size_ml","kcal","prot","fat","carb"])
        w.writeheader()
        for r in base_rows: w.writerow(r)

    # milks → percent дельты per (base, kind), averaged across всех размеров одного продукта
    # main-строка по размеру — lookup из base_rows
    main_lookup: dict[tuple[str, int | None], dict] = {}
    for r in base_rows:
        main_lookup[(r["base_norm"], r["size_ml"])] = r

    # milks_by_base_size: {(base, size): {kind: milk_row}}
    # Собираем все ratio'ы по (base, kind)
    ratios: dict[tuple[str, str], list[tuple[float, float, float, float]]] = {}
    for (base_norm, size_ml), kmap in milks_by_base_size.items():
        main = main_lookup.get((base_norm, size_ml))
        if not main:
            continue
        for kind, milk in kmap.items():
            def ratio(field):
                b = main[field]
                return (milk[field] / b) if b else 1.0
            ratios.setdefault((base_norm, kind), []).append(
                (ratio("kcal"), ratio("prot"), ratio("fat"), ratio("carb"))
            )

    milk_rows = []
    for (base_norm, kind), pts in ratios.items():
        n = len(pts)
        avg = (
            sum(p[0] for p in pts) / n,
            sum(p[1] for p in pts) / n,
            sum(p[2] for p in pts) / n,
            sum(p[3] for p in pts) / n,
        )
        milk_rows.append({
            "base_norm": base_norm, "kind": kind,
            "kcal_pct": round((avg[0] - 1) * 100, 1),
            "prot_pct": round((avg[1] - 1) * 100, 1),
            "fat_pct": round((avg[2] - 1) * 100, 1),
            "carb_pct": round((avg[3] - 1) * 100, 1),
        })

    with (HERE/"kbju_milks.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["base_norm","kind","kcal_pct","prot_pct","fat_pct","carb_pct"])
        w.writeheader()
        for r in milk_rows: w.writerow(r)

    # уникальные товары с молоком
    with (HERE/"kbju_milk_products.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f); w.writerow(["base_norm"])
        seen = set()
        for (base, _), _ in milks_by_base_size.items():
            if base not in seen:
                w.writerow([base]); seen.add(base)

    print(f"base={len(base_rows)}, milk pct rows={len(milk_rows)}, products c молоком={len(seen)}")
    # предпросмотр для 3 продуктов
    for target in ["капучино", "латте", "айс матча латте зеленый"]:
        entries = [r for r in milk_rows if r["base_norm"] == target]
        if not entries: continue
        print(f"  {target}:")
        for r in entries:
            print(f"    {r['kind']:12s} ΔKкал={r['kcal_pct']:+.1f}%  Δб={r['prot_pct']:+.1f}%  Δж={r['fat_pct']:+.1f}%  Δу={r['carb_pct']:+.1f}%")


if __name__ == "__main__":
    main()
