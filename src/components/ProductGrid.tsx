"use client";

import { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Товары не найдены
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
