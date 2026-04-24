"use client";

import Image from "next/image";
import { MouseEvent } from "react";
import { Product } from "@/lib/types";
import { FavoriteButton } from "./FavoriteButton";
import { getProductImageUrl, PHOTO_PLACEHOLDER_STYLE } from "@/lib/media";

interface FeaturedCardProps {
  product: Product;
  categoryUnit?: string;
  onClick: () => void;
}

export function FeaturedCard({ product, categoryUnit, onClick }: FeaturedCardProps) {
  const price = parseFloat(product.base_price);
  const imageUrl = getProductImageUrl(product);
  const hasUnitInWeight =
    typeof product.weight === "string" && /[а-яa-z]/i.test(product.weight);
  const weightDisplay = product.weight
    ? hasUnitInWeight || !categoryUnit
      ? product.weight
      : `${product.weight} ${categoryUnit}`
    : null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <section className="mb-6 px-2.5">
      <div className="flex items-center gap-2 px-1 mb-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-[#8E8E93] uppercase">
          <span aria-hidden>—</span>
          В фокусе дня
        </span>
      </div>
      <div
        onClick={onClick}
        className="relative rounded-[24px] overflow-hidden cursor-pointer active:scale-[0.99] transition-transform aspect-[1/1.15] md:aspect-[2.4/1]"
        style={imageUrl ? { backgroundColor: "#EAEAEA" } : PHOTO_PLACEHOLDER_STYLE}
      >
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 1200px"
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent md:bg-gradient-to-r md:from-black/70 md:via-black/30 md:to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-10 md:inset-y-0 md:right-auto md:max-w-[50%] md:flex md:flex-col md:justify-end md:p-8">
          <h2
            className="text-white leading-[1.05] [text-shadow:0_1px_2px_rgba(0,0,0,0.25)] text-[32px] md:text-[40px]"
            style={{ fontWeight: 500 }}
          >
            {product.name}
          </h2>
          {product.featured_text && (
            <p
              className="text-white/85 mt-2 leading-snug line-clamp-2 text-[13px] md:text-[15px]"
            >
              {product.featured_text}
            </p>
          )}
          <div className="flex items-end mt-4">
            <div className="flex items-center gap-2">
              <span
                className="text-white leading-none text-[24px] md:text-[28px]"
                style={{ fontWeight: 600 }}
              >
                {price.toLocaleString("ru-RU")} ₽
              </span>
              {weightDisplay && (
                <span
                  className="inline-flex items-center bg-white text-[#1A1410] rounded-full uppercase tracking-wide"
                  style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px" }}
                >
                  {weightDisplay}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Сердечко — в правый нижний угол постера */}
        <div className="absolute bottom-5 right-5 md:bottom-8 md:right-8 z-10" onClick={stop}>
          <FavoriteButton product={product} />
        </div>
      </div>
    </section>
  );
}
