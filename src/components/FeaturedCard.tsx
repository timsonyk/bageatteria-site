"use client";

import Image from "next/image";
import { MouseEvent } from "react";
import { Product } from "@/lib/types";
import { FavoriteButton } from "./FavoriteButton";

interface FeaturedCardProps {
  product: Product;
  categoryUnit?: string;
  onClick: () => void;
}

function productImage(p: Product): string {
  const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:8000";
  const mediaItem = p.media?.[0];
  const url = typeof mediaItem === "string" ? mediaItem : mediaItem?.url;
  if (!url) return "/placeholder.svg";
  if (url.startsWith("http")) return url;
  return `${MEDIA_URL}${url}`;
}

export function FeaturedCard({ product, categoryUnit, onClick }: FeaturedCardProps) {
  const price = parseFloat(product.base_price);
  const hasUnitInWeight =
    typeof product.weight === "string" && /[а-яa-z]/i.test(product.weight);
  const weightDisplay = product.weight
    ? hasUnitInWeight || !categoryUnit
      ? product.weight
      : `${product.weight} ${categoryUnit}`
    : null;

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 px-1.5 mb-3">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-[0.14em] text-[#8E8E93] uppercase">
          <span aria-hidden>—</span>
          На сегодня
        </span>
      </div>
      <div
        onClick={onClick}
        className="relative rounded-[24px] overflow-hidden bg-[#F2F2F7] cursor-pointer active:scale-[0.99] transition-transform"
      >
        <div className="relative aspect-[4/3] bg-[#EAEAEA]">
          <Image
            src={productImage(product)}
            alt={product.name}
            fill
            className="object-contain"
            sizes="100vw"
            unoptimized
          />
        </div>
        <div className="px-5 pt-4 pb-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[#8E8E93] uppercase mb-1.5">
            Сегодня в фокусе
          </p>
          <h2 className="text-[26px] font-bold text-black leading-[1.1]">
            {product.name}
          </h2>
          {product.description && (
            <p className="text-[14px] text-[#8E8E93] mt-2 leading-snug line-clamp-2">
              {product.description}
            </p>
          )}
          <div className="flex items-end justify-between mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-[22px] font-bold text-black leading-none">
                {price.toLocaleString("ru-RU")} ₽
              </span>
              {weightDisplay && (
                <span className="text-[13px] text-[#8E8E93] leading-none">
                  · {weightDisplay}
                </span>
              )}
            </div>
            <div onClick={stop}>
              <FavoriteButton product={product} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
