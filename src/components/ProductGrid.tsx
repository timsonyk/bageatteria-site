"use client";

import { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  categoryUnit?: string;
  onProductClick?: (product: Product) => void;
}

export function ProductGrid({ products, categoryUnit, onProductClick }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Товары не найдены
      </div>
    );
  }

  // Рисуем парами, чтобы items-stretch + flex внутри карточки выравнивали
  // цены по самой длинной (2-строчной) подписи в ряду.
  const rows: Product[][] = [];
  for (let i = 0; i < products.length; i += 2) {
    rows.push(products.slice(i, i + 2));
  }

  return (
    <div className="flex flex-col gap-y-5">
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-2 gap-2.5 items-stretch">
          {row.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categoryUnit={categoryUnit}
              onClick={() => onProductClick?.(product)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
