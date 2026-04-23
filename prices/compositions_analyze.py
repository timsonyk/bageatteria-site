"""Анализ компонент: матчинг названий из файла составов к товарам в БД.
Dry-run — ничего не меняет, только выводит отчёт.
"""
import difflib
import re
import sys
from pathlib import Path

import pandas as pd
import psycopg

HERE = Path(__file__).parent
COMPOSITIONS = Path("/tmp/compositions.xlsx")


def norm_name(s: str | None) -> str:
    if not s:
        return ""
    x = s.strip().casefold().replace("ё", "е")
    x = re.sub(r"[\"'«»„“”()\[\]]", "", x)
    x = x.replace("—", "-").replace("–", "-")
    x = re.sub(r"\s+", " ", x).strip()
    x = x.translate(str.maketrans("aeocxp", "аеосхр"))
    return x


def load_compositions() -> list[dict]:
    xl = pd.ExcelFile(COMPOSITIONS)
    rows: list[dict] = []
    for sheet in xl.sheet_names:
        df = pd.read_excel(COMPOSITIONS, sheet_name=sheet, header=None)
        # skip first 2 rows (category title + column headers)
        for _, r in df.iloc[2:].iterrows():
            name = r[1]
            ingredients = r[2] if 2 in r.index else None
            description = r[3] if 3 in r.index else None
            if pd.isna(name) or not str(name).strip():
                continue
            rows.append({
                "sheet": sheet,
                "name": str(name).strip(),
                "ingredients": str(ingredients).strip() if pd.notna(ingredients) else None,
                "description": str(description).strip() if pd.notna(description) else None,
                "norm": norm_name(str(name)),
            })
    return rows


def main():
    # Connect to local DB
    with psycopg.connect("postgresql://veryberry:veryberry@localhost:5432/veryberry") as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, ingredients, description FROM products ORDER BY id")
            products = cur.fetchall()

    by_norm = {}
    for pid, name, ing, desc in products:
        by_norm[norm_name(name)] = {"id": pid, "name": name, "ingredients": ing, "description": desc}

    all_norms = list(by_norm.keys())

    comps = load_compositions()
    print(f"Всего записей в файле: {len(comps)}")
    print(f"Товаров в БД: {len(by_norm)}")
    print()

    exact = []
    fuzzy = []
    unmatched = []

    for c in comps:
        if c["norm"] in by_norm:
            exact.append((c, by_norm[c["norm"]]))
        else:
            matches = difflib.get_close_matches(c["norm"], all_norms, n=1, cutoff=0.82)
            if matches:
                fuzzy.append((c, by_norm[matches[0]], matches[0]))
            else:
                unmatched.append(c)

    print(f"=== EXACT ({len(exact)}) ===")
    for c, p in exact:
        print(f"  [{c['sheet'][:10]:10s}] {c['name']!r:40s} ↔ #{p['id']} {p['name']!r}")
    print()

    print(f"=== FUZZY ({len(fuzzy)}) — требуют взгляда ===")
    for c, p, matched_norm in fuzzy:
        print(f"  [{c['sheet'][:10]:10s}] {c['name']!r:40s}")
        print(f"    → #{p['id']} {p['name']!r}")
        print(f"       norm: {c['norm']!r}  vs  {matched_norm!r}")
    print()

    print(f"=== UNMATCHED ({len(unmatched)}) — не нашли товара в БД ===")
    for c in unmatched:
        print(f"  [{c['sheet'][:10]:10s}] {c['name']!r}  (norm={c['norm']!r})")
    print()


if __name__ == "__main__":
    main()
