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
    <section className="mb-6 px-2.5">
      <div className="flex items-center gap-2 px-1 mb-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-[#8E8E93] uppercase">
          <span aria-hidden>—</span>
          В фокусе дня
        </span>
      </div>
      <div
        onClick={onClick}
        className="relative rounded-[24px] overflow-hidden bg-[#EAEAEA] cursor-pointer active:scale-[0.99] transition-transform"
        style={{ aspectRatio: "1 / 1.15" }}
      >
        <Image
          src={productImage(product)}
          alt={product.name}
          fill
          className="object-cover"
          sizes="100vw"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-10">
          <h2
            className="text-white leading-[1.05] [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]"
            style={{ fontSize: 32, fontWeight: 500 }}
          >
            {product.name}
          </h2>
          {product.featured_text && (
            <p
              className="text-white/85 mt-2 leading-snug line-clamp-2"
              style={{ fontSize: 13 }}
            >
              {product.featured_text}
            </p>
          )}
          <div className="flex items-end justify-between mt-4">
            <div className="flex items-center gap-2">
              <span
                className="text-white leading-none"
                style={{ fontSize: 24, fontWeight: 600 }}
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
            <div onClick={stop}>
              <FavoriteButton product={product} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
