"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { Product } from "@/lib/types";
import { FavoriteButton } from "./FavoriteButton";

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
  if (products.length === 0) return null;

  return (
    <section className="mt-1 mb-6">
      <div className="flex items-end justify-between px-1.5 mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-[18px] h-[18px] text-black" strokeWidth={1.75} />
          <h2 className="text-[22px] font-bold text-black leading-none">Рекомендуем</h2>
        </div>
        <span className="text-[13px] text-[#8E8E93] leading-none pb-0.5">подобрано для вас</span>
      </div>
      <div
        className="flex gap-2.5 overflow-x-auto snap-x -mx-2.5 px-2.5 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {products.map((p) => {
          const price = parseFloat(p.base_price);
          return (
            <div
              key={p.id}
              className="flex-shrink-0 w-[158px] snap-start cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => onProductClick(p)}
            >
              <div className="relative aspect-square bg-[#EAEAEA] rounded-[16px]">
                <div className="absolute inset-0 overflow-hidden rounded-[16px]">
                  <Image
                    src={productImage(p)}
                    alt={p.name}
                    fill
                    sizes="160px"
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div className="absolute bottom-2 right-2 z-10">
                  <FavoriteButton product={p} />
                </div>
              </div>
              <div className="mt-2 pl-1 pr-1">
                <h3 className="text-[14px] font-medium text-black leading-tight line-clamp-2 min-h-[34px]">
                  {p.name}
                </h3>
                <span className="text-[13px] text-black mt-1 block">
                  {price.toLocaleString("ru-RU")} ₽
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
