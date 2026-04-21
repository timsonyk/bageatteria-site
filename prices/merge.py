"""Финальная сборка: 4 xlsx → products.csv, sizes.csv, availability.csv
Применяются ручные решения по конфликтам из переписки.
"""
import pandas as pd
from collections import Counter
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
from eda import load_all, norm_name

HERE = Path(__file__).parent

FILE_LOC = {
    "download_price_list.xlsx": "депо",
    "download_price_list (1).xlsx": "смоленка",
    "download_price_list (2).xlsx": "зил",
    "download_price_list (3).xlsx": "привоз",
}
LOC_PRIORITY = ["депо", "привоз", "зил", "смоленка"]  # для выбора display name


# --- Ручные merges (fuzzy): нормализованные имена, которые нужно слить ---
# ключ = каноническое нормализованное имя, значение = список альтернатив (которые надо привести к ключу)
MERGES = {
    "айс матча латте зеленый": ["айс латте матча зеленый"],
    "лимонад манго-маракуйя": ["лимонад манго-маракуй"],
    "багеттерия vol.2": ["багетерия vol.2"],
    "багеттерия": ["багетерия"],
    "батончик сникерс": ["батончик сникерч"],
    "паштель де ната": ["паштель де-ната", "паштель де натa"],  # включая латинскую a
    "эстерхази": ["эстрехази"],
    "овощной салат со сметаной и яйцом пашот": ["овощной салат о сметаной и яйцом пашот"],
    "запеканка творожная с грушей в карамели": ["запеканка творожная с грушей с карамелью"],
    "салат с запеченной тыквой и свеклой": ["салат с медовой тыквой и свеклой"],
}
# Обратный индекс: alt → canonical
ALT_TO_CANON = {alt: canon for canon, alts in MERGES.items() for alt in alts}


def canonicalize(name_norm: str) -> str:
    return ALT_TO_CANON.get(name_norm, name_norm)


def pretty(name_norm: str) -> str:
    """Вернуть отображаемое имя: с заглавной первой, с восстановленной ё где очевидно."""
    if not name_norm:
        return ""
    # «VOL.2» — латиница, восстанавливаем регистр
    s = name_norm
    s = s.replace("vol.2", "VOL.2").replace("vol. 2", "VOL.2")
    # Капитализация первой буквы
    s = s[0].upper() + s[1:]
    # Можно вернуть ё в известных словах (опционально — пропустим)
    return s


def pick_price(group: pd.DataFrame) -> float | None:
    """Majority wins; при ничьей — максимум."""
    prices = group.dropna(subset=["цена"])["цена"].tolist()
    if not prices:
        return None
    c = Counter(prices)
    top_count = c.most_common(1)[0][1]
    tied = [p for p, cnt in c.items() if cnt == top_count]
    return max(tied) if len(tied) > 1 else tied[0]


def pick_category(group: pd.DataFrame) -> str | None:
    cats = [c for c in group["категория"].dropna().tolist() if c]
    if not cats:
        return None
    c = Counter(cats)
    top_count = c.most_common(1)[0][1]
    tied = [k for k, cnt in c.items() if cnt == top_count]
    if len(tied) == 1:
        return tied[0]
    # На тай — по приоритету локаций (депо = "авторитет")
    for loc in LOC_PRIORITY:
        sub = group[group["location"] == loc]["категория"].dropna()
        if not sub.empty:
            v = sub.iloc[0]
            if v in tied:
                return v
    return tied[0]


def pick_description(group: pd.DataFrame) -> str | None:
    """Самое длинное описание (user: Турецкий завтрак и Чиабатта — длинное)."""
    descs = [str(d).strip() for d in group["описание"].dropna().tolist() if str(d).strip()]
    if not descs:
        return None
    # нормализуем пробелы/переносы
    import re
    def clean(s):
        return re.sub(r"\s+", " ", s).strip()
    descs = list({clean(d) for d in descs})
    return max(descs, key=len)


def main():
    long = load_all()
    long["location"] = long["source_file"].map(FILE_LOC)

    # 1) Применяем MERGES к normalized_name
    long["canon"] = long["normalized_name"].map(canonicalize)

    # 2) Убираем дубль «хала» в привозе (два одинаковых ряда)
    long = long.drop_duplicates(subset=["canon", "location", "qty", "unit", "цена", "описание"])

    # 3) Подклеить NaN-размеры к явному, если у канона ровно один явный размер
    for canon in long["canon"].dropna().unique():
        mask_canon = long["canon"] == canon
        explicit = (
            long.loc[mask_canon, ["qty", "unit"]]
            .dropna(subset=["qty"])
            .drop_duplicates()
        )
        if len(explicit) == 1:
            q = explicit.iloc[0]["qty"]
            u = explicit.iloc[0]["unit"]
            # назначаем тем, где qty=NaN
            nan_mask = mask_canon & long["qty"].isna()
            long.loc[nan_mask, "qty"] = q
            long.loc[nan_mask, "unit"] = u

    # 3) Группируем по canon (каждая уникальная позиция → товар)
    products = []
    sizes_rows = []
    availability_rows = []

    for canon, g in long.groupby("canon"):
        if not canon:
            continue
        category = pick_category(g)
        description = pick_description(g)
        locations = sorted(g["location"].dropna().unique().tolist())

        # Размеры: группы по (qty, unit)
        size_groups = g.groupby(["qty", "unit"], dropna=False)
        size_list = []
        for (q, u), sg in size_groups:
            price = pick_price(sg)
            if price is None:
                continue  # нет цены — пропускаем этот размер
            size_list.append({
                "qty": None if pd.isna(q) else float(q),
                "unit": None if pd.isna(u) else str(u),
                "price": float(price),
            })

        if not size_list:
            continue  # товар без цены вовсе — пропускаем

        # Если размер один (qty+unit одинаковые) и qty нет — это «одна цена, без размера»
        is_multi_size = len(size_list) > 1

        base_price = size_list[0]["price"]
        base_qty = size_list[0]["qty"]
        base_unit = size_list[0]["unit"]

        products.append({
            "canonical_name": canon,
            "display_name": pretty(canon),
            "category": category,
            "description": description,
            "base_price": base_price,
            "base_qty": base_qty,
            "base_unit": base_unit,
            "is_multi_size": is_multi_size,
            "locations": ";".join(locations),
            "is_active": True,  # все (и в наличии, и нет) кладём активными
        })

        if is_multi_size:
            # сортируем по qty — меньший → больший
            size_list_sorted = sorted(size_list, key=lambda x: (x["qty"] is None, x["qty"] or 0))
            for idx, sz in enumerate(size_list_sorted):
                # имя размера: S/M/L по позиции
                size_name = ["S", "M", "L"][idx] if idx < 3 else f"#{idx+1}"
                sizes_rows.append({
                    "canonical_name": canon,
                    "size_name": size_name,
                    "qty": sz["qty"],
                    "unit": sz["unit"],
                    "price": sz["price"],
                    "sort_order": idx,
                })

        for loc in locations:
            availability_rows.append({
                "canonical_name": canon,
                "location": loc,
            })

    products_df = pd.DataFrame(products).sort_values(["category", "display_name"])
    sizes_df = pd.DataFrame(sizes_rows)
    availability_df = pd.DataFrame(availability_rows).sort_values(["canonical_name", "location"])

    products_df.to_csv(HERE / "products.csv", index=False)
    sizes_df.to_csv(HERE / "sizes.csv", index=False)
    availability_df.to_csv(HERE / "availability.csv", index=False)

    # Сводка
    print("=== SUMMARY ===")
    print(f"Товаров: {len(products_df)}")
    print(f"Multi-size товаров: {int(products_df['is_multi_size'].sum())}  → {len(sizes_df)} строк размеров")
    print(f"Строк availability (товар × точка): {len(availability_df)}")
    print()
    print("По категориям:")
    print(products_df.groupby("category").size().sort_values(ascending=False).to_string())
    print()
    print("По количеству точек:")
    by_loc_count = products_df["locations"].str.count(";").add(1).value_counts().sort_index()
    for n, cnt in by_loc_count.items():
        print(f"  в {n} точке(ах): {cnt} товар(ов)")
    print()
    print("Multi-size товары:")
    multi = products_df[products_df["is_multi_size"]][["display_name", "category"]]
    print(multi.to_string(index=False))


if __name__ == "__main__":
    main()
