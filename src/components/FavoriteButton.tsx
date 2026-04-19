"use client";

import { Heart, Minus, Plus } from "lucide-react";
import { MouseEvent } from "react";
import { Product } from "@/lib/types";
import { useFavorites } from "@/contexts/FavoritesContext";
import { getDefaultVariant } from "@/lib/favorites";

interface FavoriteButtonProps {
  product: Product;
}

export function FavoriteButton({ product }: FavoriteButtonProps) {
  const { getProductQty, addVariant, decrementProduct } = useFavorites();
  const qty = getProductQty(product.id);
  const active = qty > 0;

  const stop = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const handleAdd = (e: MouseEvent) => {
    stop(e);
    const { sizeId, optionIds } = getDefaultVariant(product);
    addVariant(product.id, sizeId, optionIds);
  };

  const handleSub = (e: MouseEvent) => {
    stop(e);
    decrementProduct(product.id);
  };

  return (
    <div
      onClick={stop}
      className={`relative h-10 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] overflow-hidden transition-[width] duration-300 ease-out ${active ? "w-[108px]" : "w-10"}`}
    >
      <button
        type="button"
        aria-label="Добавить в избранное"
        onClick={handleAdd}
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${active ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      >
        <Heart className="w-[22px] h-[22px] text-black" strokeWidth={1.75} />
      </button>

      <div
        className={`absolute inset-0 flex items-center justify-between px-1.5 transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <button
          type="button"
          aria-label="Уменьшить"
          onClick={handleSub}
          className="w-9 h-9 flex items-center justify-center"
        >
          <Minus className="w-[18px] h-[18px] text-black" strokeWidth={2} />
        </button>
        <span className="text-[15px] font-semibold text-black tabular-nums min-w-[20px] text-center">
          {qty}
        </span>
        <button
          type="button"
          aria-label="Увеличить"
          onClick={handleAdd}
          className="w-9 h-9 flex items-center justify-center"
        >
          <Plus className="w-[18px] h-[18px] text-black" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
