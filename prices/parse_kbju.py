"""Парсит KBJU xlsx → CSV с КБЖУ на 100 г и размерами.

Выходы:
 base.csv:  base_norm, sizes_ml (;-разделённые), kcal_100, prot_100, fat_100, carb_100
 milks.csv: base_norm, kind, kcal_100, prot_100, fat_100, carb_100
     (полная замена базы для этой опции; при выборе: итог = X_per_100g × размер / 100)
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
    # собираем по каждому base: per100 (среднее, т.к. в файле для разных размеров чуть разное
    # из-за округления) + список обнаруженных размеров (для ProductSize.volume_ml).
    base_data: dict[str, dict] = {}
    milk_data: dict[tuple[str, str], list[dict]] = {}  # (base, kind) → list of per-100 rows
    current_base = None

    for i in range(5, len(df)):
        name = df.iloc[i, 0]
        if pd.isna(name): continue
        name = str(name).strip()
        # колонки на 100 г: 1=Ж 2=Б 3=У 4=К
        fat100 = df.iloc[i, 1]; prot100 = df.iloc[i, 2]; carb100 = df.iloc[i, 3]; kcal100 = df.iloc[i, 4]
        if pd.isna(kcal100):
            continue

        if name.startswith("-"):
            raw = re.sub(r"^-\s*", "", name).strip()
            raw = re.sub(r"^на\s+", "", raw, flags=re.IGNORECASE).strip()
            kind = MILK_KIND_MAP.get(raw.casefold())
            if not kind or current_base is None:
                continue
            milk_data.setdefault((current_base, kind), []).append({
                "kcal": float(kcal100), "prot": float(prot100 or 0),
                "fat": float(fat100 or 0), "carb": float(carb100 or 0),
            })
            continue

        # main row
        m = re.match(r"^(.+?)\s+(\d+)\s*(мл|г|гр)\.?\s*$", name, flags=re.IGNORECASE)
        if m:
            base = m.group(1).strip()
            size_ml = int(m.group(2))
        else:
            base = name
            size_ml = None
        base_norm = NAME_MAP_NORM.get(norm_name(base), norm_name(base))
        current_base = base_norm

        bd = base_data.setdefault(base_norm, {"rows": [], "sizes": []})
        bd["rows"].append({
            "kcal": float(kcal100), "prot": float(prot100 or 0),
            "fat": float(fat100 or 0), "carb": float(carb100 or 0),
        })
        if size_ml and size_ml not in bd["sizes"]:
            bd["sizes"].append(size_ml)

    # Если размер не указан явно, пытаемся вычислить из per100/perPortion ratio
    # (уже сделано для weight через SQL, но сохраним здесь для базового объёма)
    # Усредняем per-100 по всем строкам базы (разные размеры даёт чуть разное из-за округления)
    base_rows = []
    for base_norm, bd in base_data.items():
        n = len(bd["rows"])
        avg = lambda f: sum(r[f] for r in bd["rows"]) / n
        base_rows.append({
            "base_norm": base_norm,
            "sizes_ml": ";".join(str(s) for s in sorted(bd["sizes"])),
            "kcal_100": round(avg("kcal"), 2),
            "prot_100": round(avg("prot"), 2),
            "fat_100": round(avg("fat"), 2),
            "carb_100": round(avg("carb"), 2),
        })

    # milks: среднее per-100 по (base, kind) среди всех размеров
    milk_rows = []
    for (base_norm, kind), arr in milk_data.items():
        n = len(arr)
        avg = lambda f: sum(r[f] for r in arr) / n
        milk_rows.append({
            "base_norm": base_norm, "kind": kind,
            "kcal_100": round(avg("kcal"), 2),
            "prot_100": round(avg("prot"), 2),
            "fat_100": round(avg("fat"), 2),
            "carb_100": round(avg("carb"), 2),
        })

    with (HERE/"kbju_base.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["base_norm","sizes_ml","kcal_100","prot_100","fat_100","carb_100"])
        w.writeheader()
        for r in base_rows: w.writerow(r)

    with (HERE/"kbju_milks.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["base_norm","kind","kcal_100","prot_100","fat_100","carb_100"])
        w.writeheader()
        for r in milk_rows: w.writerow(r)

    with (HERE/"kbju_milk_products.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f); w.writerow(["base_norm"])
        seen = set()
        for (base, _), _ in milk_data.items():
            if base not in seen:
                w.writerow([base]); seen.add(base)

    print(f"base={len(base_rows)}, milks={len(milk_rows)}, milk_products={len(seen)}")
    for r in base_rows[:5]:
        print(f"  {r['base_norm']:30s} per100: К={r['kcal_100']}  sizes={r['sizes_ml']}")


if __name__ == "__main__":
    main()
