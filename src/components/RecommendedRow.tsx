"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import { MouseEvent } from "react";
import { Product } from "@/lib/types";
import { useFavorites } from "@/contexts/FavoritesContext";

interface RecommendedRowProps {
  products: Product[];
  onProductClick: (p: Product) => void;
}

function productImage(p: Product): string {
  const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:8000";
  const mediaItem = p.media?.[0];
  const url = typeof mediaItem === "string" ? mediaItem : mediaItem?.url;
  if (!url) return "/placeholder.svg";
  if (url.startsWith("http")) return url;
  return `${MEDIA_URL}${url}`;
}

export function RecommendedRow({ products, onProductClick }: RecommendedRowProps) {
  const { addVariant } = useFavorites();
  if (products.length === 0) return null;

  const handleAdd = (e: MouseEvent, p: Product) => {
    e.stopPropagation();
    // Из рекомендаций добавляем «голый» вариант — без модификаций и без размера,
    // чтобы цена совпадала с отображаемой, а в избранном не появлялись модификаторы.
    addVariant(p.id, null, []);
  };

  return (
    <section className="mt-1 mb-6">
      <div className="flex items-end justify-between px-1.5 mb-3">
        <h2 className="text-[20px] font-medium text-[#1A1410] leading-none tracking-[-0.3px]">Рекомендуем</h2>
        <span className="text-[12px] text-[#8E8E93] leading-none pb-0.5">подобрано для вас</span>
      </div>

      <div
        className="-mx-2.5 [&::-webkit-scrollbar]:hidden"
        style={{
          display: "flex",
          gap: 10,
          padding: "0 20px",
          overflowX: "auto",
          scrollbarWidth: "none",
          scrollSnapType: "x mandatory",
        }}
      >
        {products.map((p) => {
          const price = parseFloat(p.base_price);
          return (
            <div
              key={p.id}
              onClick={() => onProductClick(p)}
              style={{
                flex: "0 0 150px",
                background: "#FFFEFA",
                borderRadius: 16,
                padding: 10,
                scrollSnapAlign: "start",
              }}
              className="cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div
                className="relative bg-[#EAEAEA]"
                style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "1 / 0.85" }}
              >
                <Image
                  src={productImage(p)}
                  alt={p.name}
                  fill
                  sizes="150px"
                  className="object-cover"
                  unoptimized
                />
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
                <button
                  type="button"
                  aria-label="Добавить в избранное"
                  onClick={(e) => handleAdd(e, p)}
                  className="flex items-center justify-center active:scale-[0.9] transition-transform"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "#1A1410",
                    color: "#F5F1EA",
                  }}
                >
                  <Heart
                    className="w-[13px] h-[13px]"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
