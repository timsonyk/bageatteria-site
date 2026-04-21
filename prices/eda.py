"""EDA and merge script for 4 price-list exports."""
import glob
import re
import pandas as pd
from pathlib import Path

HERE = Path(__file__).parent

FILES = sorted(
    [p for p in HERE.glob("*.xlsx") if not p.name.startswith("~")],
    key=lambda p: p.name,
)


def norm_name(s: object) -> str:
    if not isinstance(s, str):
        return ""
    x = s.strip().casefold()
    # lowercase ё → е для стабильности
    x = x.replace("ё", "е")
    # убираем кавычки/скобки шумом
    x = re.sub(r"[\"'«»„“”()\[\]]", "", x)
    # тире/дефисы к одному
    x = x.replace("—", "-").replace("–", "-")
    # схлопываем пробелы
    x = re.sub(r"\s+", " ", x).strip()
    return x


def token_key(name_norm: str) -> str:
    # сортируем только «значимые» токены длиной ≥ 2, игнорируем тире/предлоги
    stop = {"и", "с", "в", "на", "из", "под", "от", "до", "для"}
    toks = [t for t in re.split(r"[\s\-]+", name_norm) if t and t not in stop]
    return " ".join(sorted(toks))


def load_all() -> pd.DataFrame:
    frames = []
    for f in FILES:
        df = pd.read_excel(f)
        df["source_file"] = f.name
        frames.append(df)
    long = pd.concat(frames, ignore_index=True)
    long["normalized_name"] = long["название"].map(norm_name)
    long["token_key"] = long["normalized_name"].map(token_key)
    # размер
    long["qty"] = long["количество"]
    long["unit"] = long["единицы измерения"]
    return long


def main():
    long = load_all()
    print(f"Всего строк из 4 файлов: {len(long)}")
    print(f"Уникальных normalized_name: {long['normalized_name'].nunique()}")
    print(f"Уникальных token_key: {long['token_key'].nunique()}")
    print()

    # Сохраняем длинный датасет
    long.to_csv(HERE / "long.csv", index=False)

    # --- FUZZY: одинаковый token_key, разные normalized_name ---
    fuzzy = (
        long.groupby("token_key")["normalized_name"]
        .nunique()
        .reset_index(name="n_variants")
    )
    fuzzy = fuzzy[fuzzy["n_variants"] > 1]
    print(f"--- FUZZY: одинаковый набор токенов, разный порядок слов ({len(fuzzy)} групп) ---")
    for tk in fuzzy["token_key"]:
        variants = sorted(long.loc[long["token_key"] == tk, "normalized_name"].unique())
        print(f"  {tk!r}  →  {variants}")
    print()

    # --- CONFLICTS: внутри (normalized_name, qty, unit) разные цены/описания/категории ---
    group_cols = ["normalized_name", "qty", "unit"]
    def _check(df):
        out = {}
        for col in ["цена", "описание", "категория", "короткое описание"]:
            vals = df[col].dropna().astype(str).str.strip().unique()
            if len(vals) > 1:
                out[col] = list(vals)
        return out

    conflicts = []
    for keys, g in long.groupby(group_cols, dropna=False):
        issues = _check(g)
        if issues:
            conflicts.append({
                "normalized_name": keys[0],
                "qty": keys[1],
                "unit": keys[2],
                "n_rows": len(g),
                "sources": sorted(g["source_file"].unique().tolist()),
                **{f"{k}_variants": " | ".join(v) for k, v in issues.items()},
            })
    conflicts_df = pd.DataFrame(conflicts)
    conflicts_df.to_csv(HERE / "conflicts.csv", index=False)
    print(f"--- CONFLICTS: внутри (name, qty, unit) разные значения ({len(conflicts_df)} групп) ---")
    if not conflicts_df.empty:
        pd.set_option("display.max_colwidth", 120)
        print(conflicts_df.to_string(index=False))
    print()

    # --- SIZES: для тех же товаров разные размеры (qty/unit) в разных файлах ---
    size_groups = long.groupby("normalized_name")[["qty", "unit"]].apply(
        lambda d: d.drop_duplicates().to_dict("records")
    )
    multi_size = size_groups[size_groups.map(len) > 1]
    print(f"--- SIZES: товары с несколькими размерами ({len(multi_size)}) ---")
    for name, sizes in multi_size.items():
        if not name:
            continue
        print(f"  {name}: {sizes}")
    print()


if __name__ == "__main__":
    main()
