"""Парсит KBJU xlsx → 2 CSV:
 base.csv:  base_norm, size_ml, kcal, prot, fat, carb
 milks.csv: milk_kind, kcal, prot, fat, carb  (deltas, уже агрегированные)
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
    milk_by_base: dict[str, list[dict]] = {}
    current_base = None

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
            milk_by_base.setdefault(current_base, []).append({
                "kind": kind, "kcal": int(round(kcal)),
                "prot": float(prot or 0), "fat": float(fat or 0), "carb": float(carb or 0),
            })
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

        base_rows.append({
            "base_norm": base_norm, "size_ml": size_ml,
            "kcal": int(round(kcal)),
            "prot": round(float(prot or 0), 2),
            "fat": round(float(fat or 0), 2),
            "carb": round(float(carb or 0), 2),
        })

    # save base
    with (HERE/"kbju_base.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["base_norm","size_ml","kcal","prot","fat","carb"])
        w.writeheader()
        for r in base_rows: w.writerow(r)

    # milk deltas PER product (не усреднённо; файл может давать разные milk
    # значения для разных сабвариантов одного продукта — усредним по размеру
    # внутри одного продукта)
    per_product: list[dict] = []
    for base_norm, milks in milk_by_base.items():
        mains = [r for r in base_rows if r["base_norm"] == base_norm]
        if not mains: continue
        main = max(mains, key=lambda r: (r["size_ml"] or 0))
        by_kind: dict[str, list] = {}
        for m in milks:
            by_kind.setdefault(m["kind"], []).append(m)
        for kind, mgroup in by_kind.items():
            # усредним, если в файле несколько (для разных размеров одного напитка)
            n = len(mgroup)
            avg_kcal = sum(m["kcal"] for m in mgroup) / n
            avg_prot = sum(m["prot"] for m in mgroup) / n
            avg_fat = sum(m["fat"] for m in mgroup) / n
            avg_carb = sum(m["carb"] for m in mgroup) / n
            per_product.append({
                "base_norm": base_norm,
                "kind": kind,
                "kcal": int(round(avg_kcal - main["kcal"])),
                "prot": round(avg_prot - main["prot"], 2),
                "fat": round(avg_fat - main["fat"], 2),
                "carb": round(avg_carb - main["carb"], 2),
            })

    with (HERE/"kbju_milks.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["base_norm","kind","kcal","prot","fat","carb"])
        w.writeheader()
        for r in per_product: w.writerow(r)

    # список продуктов, к которым крепим группу «Тип молока»
    with (HERE/"kbju_milk_products.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f); w.writerow(["base_norm"])
        for k in milk_by_base.keys(): w.writerow([k])

    print(f"Спарсено: base={len(base_rows)}, per-product deltas={len(per_product)}, products={len(milk_by_base)}")
    for r in per_product[:20]:
        print(f"  {r['base_norm']:30s} {r['kind']:12s} Δkcal={r['kcal']:+d} Δb={r['prot']:+.2f}")


if __name__ == "__main__":
    main()
