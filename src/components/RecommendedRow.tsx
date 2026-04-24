"use client";

import Image from "next/image";
import { Heart, Minus, Plus } from "lucide-react";
import { MouseEvent } from "react";
import { Product } from "@/lib/types";
import { useFavorites } from "@/contexts/FavoritesContext";
import { getProductImageUrl, PHOTO_PLACEHOLDER_STYLE } from "@/lib/media";

interface RecommendedRowProps {
  products: Product[];
  onProductClick: (p: Product) => void;
}

export function RecommendedRow({ products, onProductClick }: RecommendedRowProps) {
  const { addVariant, decrementProduct, getProductQty } = useFavorites();
  if (products.length === 0) return null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  const handleAdd = (e: MouseEvent, p: Product) => {
    stop(e);
    // Из рекомендаций добавляем «голый» вариант — без модификаций и без размера,
    // чтобы цена совпадала с отображаемой, а в избранном не появлялись модификаторы.
    addVariant(p.id, null, []);
  };

  const handleSub = (e: MouseEvent, p: Product) => {
    stop(e);
    decrementProduct(p.id);
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
                  const qty = getProductQty(p.id);
                  const active = qty > 0;
                  return (
                    <div
                      onClick={stop}
                      className="relative"
                      style={{
                        height: 26,
                        width: active ? 84 : 26,
                        borderRadius: 13,
                        background: "#1A1410",
                        color: "#F5F1EA",
                        overflow: "hidden",
                        transition: "width 260ms cubic-bezier(0.32, 0.72, 0, 1)",
                      }}
                    >
                      <button
                        type="button"
                        aria-label="Добавить в избранное"
                        onClick={(e) => handleAdd(e, p)}
                        className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
                        style={{
                          opacity: active ? 0 : 1,
                          pointerEvents: active ? "none" : "auto",
                        }}
                      >
                        <Heart className="w-[13px] h-[13px]" strokeWidth={2} strokeLinecap="round" />
                      </button>
                      <div
                        className="absolute inset-0 flex items-center justify-between px-1 transition-opacity duration-200"
                        style={{
                          opacity: active ? 1 : 0,
                          pointerEvents: active ? "auto" : "none",
                        }}
                      >
                        <button
                          type="button"
                          aria-label="Уменьшить"
                          onClick={(e) => handleSub(e, p)}
                          className="w-6 h-6 flex items-center justify-center active:scale-[0.9] transition-transform"
                        >
                          <Minus className="w-[12px] h-[12px]" strokeWidth={2} />
                        </button>
                        <span
                          className="tabular-nums text-center"
                          style={{ fontSize: 12, fontWeight: 600, minWidth: 14 }}
                        >
                          {qty}
                        </span>
                        <button
                          type="button"
                          aria-label="Увеличить"
                          onClick={(e) => handleAdd(e, p)}
                          className="w-6 h-6 flex items-center justify-center active:scale-[0.9] transition-transform"
                        >
                          <Plus className="w-[12px] h-[12px]" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
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
