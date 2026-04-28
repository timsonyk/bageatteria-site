"use client";

import { Heart } from "lucide-react";
import { MouseEvent } from "react";
import { Product } from "@/lib/types";
import { useFavorites } from "@/contexts/FavoritesContext";
import { getDefaultVariant } from "@/lib/favorites";

interface FavoriteButtonProps {
  product: Product;
  /** Размер: "default" — 40px (карточка/постер), "sm" — 28px (компактно). */
  size?: "default" | "sm";
}

export function FavoriteButton({ product, size = "default" }: FavoriteButtonProps) {
  const { getProductQty, addVariant, removeProduct } = useFavorites();
  const qty = getProductQty(product.id);
  const active = qty > 0;

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (active) {
      removeProduct(product.id);
    } else {
      const { sizeId, optionIds } = getDefaultVariant(product);
      addVariant(product.id, sizeId, optionIds);
    }
  };

  const dimensions =
    size === "sm"
      ? { box: "w-8 h-8", icon: "w-[16px] h-[16px]" }
      : { box: "w-10 h-10", icon: "w-[22px] h-[22px]" };

  return (
    <button
      type="button"
      aria-label={active ? "Убрать из избранного" : "Добавить в избранное"}
      onClick={handleClick}
      className={`${dimensions.box} rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] flex items-center justify-center active:scale-[0.92] transition-transform`}
    >
      <Heart
        className={`${dimensions.icon} ${active ? "fill-black text-black" : "text-black"}`}
        strokeWidth={1.75}
      />
    </button>
  );
}
