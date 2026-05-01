"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { MouseEvent } from "react";
import { Product } from "@/lib/types";
import { useFavorites } from "@/contexts/FavoritesContext";
import { getDefaultVariant } from "@/lib/favorites";
import { getProductImageUrl, PHOTO_PLACEHOLDER_STYLE } from "@/lib/media";

interface RecommendedRowProps {
  products: Product[];
  onProductClick: (p: Product) => void;
}

export function RecommendedRow({ products, onProductClick }: RecommendedRowProps) {
  const { addVariant, removeProduct, getProductQty } = useFavorites();
  if (products.length === 0) return null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  const toggleFavorite = (e: MouseEvent, p: Product) => {
    stop(e);
    if (getProductQty(p.id) > 0) {
      removeProduct(p.id);
    } else {
      const { sizeId, optionIds } = getDefaultVariant(p);
      addVariant(p.id, sizeId, optionIds);
    }
  };

  return (
    <section className="mt-1 mb-6 px-2.5">
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-[20px] font-medium text-[#1A1410] leading-none tracking-[-0.3px]">Рекомендуем</h2>
        <span className="text-[12px] text-[#8E8E93] leading-none pb-0.5">подобрано для вас</span>
      </div>

      <div
        className="[&::-webkit-scrollbar]:hidden"
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          scrollbarWidth: "none",
          scrollSnapType: "x mandatory",
        }}
      >
        {products.map((p) => {
          const price = parseFloat(p.base_price);
          const imageUrl = getProductImageUrl(p);
          return (
            <div
              key={p.id}
              onClick={() => onProductClick(p)}
              style={{
                background: "#FFFEFA",
                borderRadius: 16,
                padding: 10,
                scrollSnapAlign: "start",
              }}
              className="cursor-pointer active:scale-[0.98] transition-transform flex-[0_0_150px] md:flex-[0_0_200px]"
            >
              <div
                className="relative"
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  aspectRatio: "1 / 0.85",
                  ...(imageUrl ? { backgroundColor: "#EAEAEA" } : PHOTO_PLACEHOLDER_STYLE),
                }}
              >
                {imageUrl && (
                  <Image
                    src={imageUrl}
                    alt={p.name}
                    fill
                    sizes="(max-width: 768px) 150px, 200px"
                    className="object-cover"
                    unoptimized
                  />
                )}
              </div>
              <div
                className="mt-2 line-clamp-2"
                style={{ fontSize: 13, fontWeight: 500, color: "#1A1410", lineHeight: 1.2 }}
              >
                {p.name}
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <span style={{ fontSize: 14, color: "#1A1410" }}>
                  {price.toLocaleString("ru-RU")} ₽
                </span>
                {(() => {
                  const active = getProductQty(p.id) > 0;
                  return (
                    <button
                      type="button"
                      aria-label={active ? "Убрать из избранного" : "Добавить в избранное"}
                      onClick={(e) => toggleFavorite(e, p)}
                      className="w-7 h-7 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] flex items-center justify-center active:scale-[0.92] transition-transform"
                    >
                      <Heart
                        className={`w-[14px] h-[14px] text-black ${active ? "fill-black" : ""}`}
                        strokeWidth={1.75}
                      />
                    </button>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
