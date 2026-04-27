import { Product } from "./types";

export function variantKey(
  productId: number,
  sizeId: number | null,
  optionIds: number[]
): string {
  const sorted = [...optionIds].sort((a, b) => a - b);
  return `${productId}:${sizeId ?? "x"}:${sorted.join(",")}`;
}

export function getDefaultVariant(product: Product): {
  sizeId: number | null;
  optionIds: number[];
} {
  let sizeId: number | null = null;
  if (product.sizes && product.sizes.length > 0) {
    const sorted = [...product.sizes].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.length >= 3 ? 1 : 0;
    sizeId = sorted[idx]?.id ?? null;
  }
  const optionIds: number[] = [];
  if (product.modification_groups) {
    for (const g of product.modification_groups) {
      if (!g.is_active) continue;
      for (const o of g.options) {
        if (o.is_active && o.is_default) optionIds.push(o.id);
      }
    }
  }
  return { sizeId, optionIds };
}

export function computeVariantPrice(
  product: Product,
  sizeId: number | null,
  optionIds: number[]
): number {
  let base = parseFloat(product.base_price);
  if (sizeId != null && product.sizes) {
    const s = product.sizes.find((x) => x.id === sizeId);
    if (s) base = parseFloat(s.base_price);
  }
  let extras = 0;
  if (product.modification_groups && optionIds.length) {
    const idSet = new Set(optionIds);
    for (const g of product.modification_groups) {
      for (const o of g.options) {
        if (idSet.has(o.id)) extras += parseFloat(o.extra_price);
      }
    }
  }
  return base + extras;
}

export function variantSummary(
  product: Product,
  sizeId: number | null,
  optionIds: number[]
): string {
  const parts: string[] = [];
  if (sizeId != null && product.sizes) {
    const s = product.sizes.find((x) => x.id === sizeId);
    if (s) parts.push(s.name);
  }
  if (product.modification_groups && optionIds.length) {
    const idSet = new Set(optionIds);
    const names: string[] = [];
    for (const g of product.modification_groups) {
      for (const o of g.options) {
        if (idSet.has(o.id)) names.push(o.name);
      }
    }
    if (names.length) parts.push(names.join(", "));
  }
  return parts.join(" · ");
}

/**
 * Возвращает массив строк-описаний варианта — по одной на размер и каждую модификацию.
 * Используется для построчного отображения в избранном.
 */
export function variantSummaryLines(
  product: Product,
  sizeId: number | null,
  optionIds: number[]
): string[] {
  const lines: string[] = [];
  if (sizeId != null && product.sizes) {
    const s = product.sizes.find((x) => x.id === sizeId);
    if (s) lines.push(s.name);
  }
  if (product.modification_groups && optionIds.length) {
    const idSet = new Set(optionIds);
    for (const g of product.modification_groups) {
      for (const o of g.options) {
        if (idSet.has(o.id)) lines.push(o.name);
      }
    }
  }
  return lines;
}
