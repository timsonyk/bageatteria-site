"""Применить составы из xlsx к БД (ingredients + description).

Маппинг:
  - EXACT matches (~51) — автоматом
  - FUZZY matches — принимаются все, КРОМЕ оверрайденных в BAD_FUZZY
  - MANUAL_MATCHES — для unmatched из исходника, где товар есть в нашей БД
    под другим именем (опечатки/перестановка)
  - MULTI_TARGETS — один состав применяется к нескольким товарам
  - NOT_IN_DB — товары из исходника, которых в нашей БД нет (пропускаем)

--dry-run: только отчёт, без изменений.
"""
import argparse
import difflib
import re
import sys
from pathlib import Path

import pandas as pd
import psycopg

HERE = Path(__file__).parent
COMPOSITIONS = Path("/tmp/compositions.xlsx")

# Fuzzy-матчи, которые fuzzy-скор даёт неверно — отменяем, обрабатываем вручную
BAD_FUZZY = {
    "вафли с лососем и яйцом пашот",  # неверно матчилось на «Салат с лососем и яйцом пашот»
    "сэндвич с пасторами из индейки/телятины",  # относится к двум товарам сразу
}

# Ручные (unmatched): исходное имя (как в файле) → имя товара в нашей БД
MANUAL_MATCHES: dict[str, str] = {
    "Хлеб клюквенный с кедровыми орехами": "Хлеб пшеничный с клюквой и кедровыми орешками",
    "Ржаной с семечками": "Хлеб ржаной с семенами подсолнуха",
    "Тарт лимонный": "Лимонный тарт",
    "Сникерс": "Батончик сникерс",
    "Конфета соленая карамель": "Куб соленая карамель",
    "Конфета ваниль - малина": "Малина ваниль",
    "Конфета вишневый мармелад": "Вишня мармелад",
    "Десерт Багеттерия": "Багеттерия",
    "Брускета с грибами на Бородинском хлебе": "Брускетта с грибами",
    "Венские вафли с ягодой и нутеллы": "Вафли с нутеллой",
    "Гречка зелёная со строчит тело и яйцом пашот": "Зеленая греча с яйцом пашот и страчателлой",
    "Завтрак гречески": "Греческий завтрак",
    "Завтрак Турецкий": "Турецкий завтрак",
    "Панкейки с ягодами кленовым сиропом": "Панкейки с кленовым сиропом и ягодами",
    "Салат греческий": "Греческий салат",
    "Салат из креветок с папой": "Салат с папайей и креветками",
    "Салат овощной со сметаной": "Овощной салат со сметаной и яйцом пашот",
    "Сырники": "Сырники со сметаной и вишневым вареньем",
    "Чиабатта с тунцом и соусом Витело Таната": "Чиабатта с тунцом",
    "Фриттата со страчателлой": "Фритата со страчателлой и томатами",
    "Вафли с лососем и яйцом пашот": "Вафли с лососем",  # правит BAD_FUZZY
    "Мини чиабатта": "Чиабатта мини",
    "Хлеб тостовый": "Тостовый хлеб",
    "А салат с авокадо грейпфрутом из три телы": "Салат с грейпфрутом и страчателлой",
    "Фритата С пастами из говядины": "Фриттата с пастрами",
}

# Один состав → несколько товаров (разделены /)
MULTI_TARGETS: dict[str, list[str]] = {
    "брускета с крабом и креветкой": ["Брускетта с крабом"],  # у нас один вариант
    "Драники с индейкой/лосось и яйцом пашот": [
        "Картофельные драники с индейкой и яйцом пашот",
        "Картофельные драники с лососем и яйцом пашот",
    ],
    "Сэндвич с пасторами из индейки/телятины": [
        "Сэндвич с пастрами из индейки",
        "Сэндвич с пастрами из телятины",
    ],
}

# Явно пропускаем — нет аналога в нашей БД
NOT_IN_DB = {
    "НАИМЕНОВАНИЕ",  # заголовки листов
    "Багет классический",
    "Хлеб турт с тмином",
    "Бурекс с грибами",
    "Круассан фисташковый",
    "Симит палочка",
    "Булка с черникой",
    "Куб фисташка-малина",
    "Рулет мереновый со смородиной",
    "Рулет меренговый с клубникой",
    "Рулет меренговый с фисташкой",
    "Эклер кофе - карамель",
    "Конфета кокос - ром",
    "Конфета банановое мороженое",
    "Конфета черничный йогурт",
    "Конфета манго",
    "Печенье амаретти",
    "Багет моцарелла с  томатами",
    "Багет с лососем и Гуакомолле",
    "Багет пострами с индейкой",
    "Багет песто и Черри",
    "Багет с тунцом и соусом Витело Таната",
    "Блины с бананом и мороженым",
    "Блины с лососем и кремом Chisum",
    "Блины с творогом и домашним вареньем",
    "Каша овсяная на молоке",
    "Каша Пшеничная с сухофруктами",
    "Хлеб масло",
    "Чиабатта моцарелла с томатами",
    "Чиабатта с лососем и гуакамоле",
    "Чиабатта с пасторами из индейки",
    "Яйцо пашот с голландским соусом",
    "Яйцо пашот со шпинатом соусом",
}


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
        for _, r in df.iloc[2:].iterrows():
            name = r[1]
            ingredients = r[2] if 2 in r.index else None
            description = r[3] if 3 in r.index else None
            if pd.isna(name) or not str(name).strip():
                continue
            name_s = str(name).strip()
            if name_s.upper() == "НАИМЕНОВАНИЕ":
                continue
            rows.append({
                "sheet": sheet,
                "name": name_s,
                "ingredients": str(ingredients).strip() if pd.notna(ingredients) else None,
                "description": str(description).strip() if pd.notna(description) else None,
            })
    return rows


def resolve_targets(
    comp_name: str,
    by_norm: dict[str, dict],
    all_norms: list[str],
) -> tuple[list[int], str]:
    """→ (список product_id, описание_резолюции)."""
    # 1) MANUAL
    if comp_name in MANUAL_MATCHES:
        target_name = MANUAL_MATCHES[comp_name]
        key = norm_name(target_name)
        p = by_norm.get(key)
        if p:
            return [p["id"]], f"manual→{p['name']}"
        return [], f"manual-miss:{target_name!r}"

    # 2) MULTI
    if comp_name in MULTI_TARGETS:
        ids: list[int] = []
        names: list[str] = []
        for t in MULTI_TARGETS[comp_name]:
            p = by_norm.get(norm_name(t))
            if p:
                ids.append(p["id"])
                names.append(p["name"])
        return ids, f"multi→{names}"

    # 3) NOT_IN_DB
    if comp_name in NOT_IN_DB:
        return [], "skip-not-in-db"

    n = norm_name(comp_name)

    # 4) EXACT
    if n in by_norm:
        return [by_norm[n]["id"]], f"exact→{by_norm[n]['name']}"

    # 5) BAD_FUZZY (должен обрабатываться MANUAL — сюда не попадёт)
    if n in BAD_FUZZY:
        return [], "bad-fuzzy"

    # 6) FUZZY
    matches = difflib.get_close_matches(n, all_norms, n=1, cutoff=0.82)
    if matches and matches[0] not in BAD_FUZZY:
        p = by_norm[matches[0]]
        return [p["id"]], f"fuzzy→{p['name']}"

    return [], "no-match"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="postgresql://veryberry:veryberry@localhost:5432/veryberry")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with psycopg.connect(args.db) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name FROM products ORDER BY id")
            products = cur.fetchall()
        by_norm = {norm_name(name): {"id": pid, "name": name} for pid, name in products}
        all_norms = list(by_norm.keys())

        comps = load_compositions()
        print(f"Записей в файле: {len(comps)} | Товаров в БД: {len(by_norm)}")
        print()

        updates: list[tuple[int, str | None, str | None, str]] = []
        skipped: list[tuple[dict, str]] = []

        for c in comps:
            ids, reason = resolve_targets(c["name"], by_norm, all_norms)
            if not ids:
                skipped.append((c, reason))
                continue
            for pid in ids:
                updates.append((pid, c["ingredients"], c["description"], f"{c['name']!r} → {reason}"))

        print(f"=== БУДЕТ ОБНОВЛЕНО: {len(updates)} строк ===")
        for pid, ing, desc, why in updates[:10]:
            print(f"  #{pid}  {why}")
        if len(updates) > 10:
            print(f"  … и ещё {len(updates)-10}")
        print()

        print(f"=== ПРОПУСКИ: {len(skipped)} ===")
        by_reason: dict[str, list] = {}
        for c, reason in skipped:
            by_reason.setdefault(reason.split(":")[0], []).append(c)
        for reason, items in by_reason.items():
            print(f"  [{reason}] — {len(items)}:")
            for c in items[:20]:
                print(f"    {c['sheet'][:10]:10s} {c['name']!r}")

        if args.dry_run:
            print("\n[dry-run] изменения НЕ применены")
            return

        # Apply
        with conn.cursor() as cur:
            applied = 0
            for pid, ing, desc, _ in updates:
                # обновляем только непустыми значениями
                sets = []
                params: list = []
                if ing:
                    sets.append("ingredients = %s")
                    params.append(ing)
                if desc:
                    sets.append("description = %s")
                    params.append(desc)
                if not sets:
                    continue
                params.append(pid)
                cur.execute(f"UPDATE products SET {', '.join(sets)} WHERE id = %s", params)
                applied += 1
            conn.commit()
            print(f"\nПрименено: {applied} апдейтов")


if __name__ == "__main__":
    main()
