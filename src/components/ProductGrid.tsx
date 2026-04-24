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

  // CSS Grid выравнивает высоту всех карточек в строке (items-stretch по умолчанию),
  // а mt-auto на цене прибивает её к низу — цены в ряду совпадают.
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-2.5 gap-y-5 items-stretch">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          categoryUnit={categoryUnit}
          onClick={() => onProductClick?.(product)}
        />
      ))}
    </div>
  );
}
