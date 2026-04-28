"use client";

import Image from "next/image";
import { MouseEvent, useEffect, useRef, useState } from "react";
import { Product, Category } from "@/lib/types";
import { FavoriteButton } from "./FavoriteButton";
import { getProductImageUrl, prefixMediaUrl, PHOTO_PLACEHOLDER_STYLE } from "@/lib/media";

interface FeaturedCardProps {
  products: Product[];
  categoryMap: Map<number, Category>;
  onProductClick: (p: Product) => void;
}

const AUTO_PLAY_MS = 12000;

export function FeaturedCard({ products, categoryMap, onProductClick }: FeaturedCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isHorizontalSwipe, setIsHorizontalSwipe] = useState(false);
  const suppressClickRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const total = products.length;

  // Авто-листание раз в 7 секунд
  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => {
      setActiveIndex((i) => (i + 1) % total);
    }, AUTO_PLAY_MS);
    return () => clearInterval(t);
  }, [total, activeIndex]);

  // Сброс смещения при смене активной карточки
  useEffect(() => {
    setDragOffset(0);
  }, [activeIndex]);

  // Pointer events работают и на тач, и на мышь.
  const handlePointerDown = (e: React.PointerEvent) => {
    // Игнорируем правую кнопку мыши
    if (e.pointerType === "mouse" && e.button !== 0) return;
    setTouchStartX(e.clientX);
    setTouchStartY(e.clientY);
    setIsHorizontalSwipe(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (touchStartX == null || touchStartY == null) return;
    const dx = e.clientX - touchStartX;
    const dy = e.clientY - touchStartY;
    if (!isHorizontalSwipe) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        setIsHorizontalSwipe(true);
      } else if (Math.abs(dy) > 8) {
        setTouchStartX(null);
        setTouchStartY(null);
        return;
      }
    }
    if (isHorizontalSwipe || Math.abs(dx) > Math.abs(dy)) {
      setDragOffset(dx);
    }
  };

  const handlePointerEnd = () => {
    if (touchStartX == null) {
      setDragOffset(0);
      return;
    }
    const offset = dragOffset;
    setTouchStartX(null);
    setTouchStartY(null);
    setDragOffset(0);
    if (Math.abs(offset) > 50) {
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 300);
      if (offset < 0 && activeIndex < total - 1) setActiveIndex(activeIndex + 1);
      else if (offset > 0 && activeIndex > 0) setActiveIndex(activeIndex - 1);
    }
    setIsHorizontalSwipe(false);
  };

  const stopPointer = (e: MouseEvent) => e.stopPropagation();

  return (
    <section className="mb-6 px-2.5">
      <div className="flex items-center gap-2 px-1 mb-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-[#8E8E93] uppercase">
          <span aria-hidden>—</span>
          Наши новинки
        </span>
      </div>
      <div
        ref={containerRef}
        className="relative rounded-[24px] overflow-hidden aspect-[1/1.15] md:aspect-[2.4/1] select-none touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {/* Слайды */}
        <div
          className="absolute inset-0 flex"
          style={{
            transform: `translateX(calc(${-activeIndex * 100}% + ${dragOffset}px))`,
            transition: touchStartX != null ? "none" : "transform 0.75s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          {products.map((product) => {
            const price = parseFloat(product.base_price);
            const mobileImageUrl = getProductImageUrl(product);
            const desktopImageUrl =
              prefixMediaUrl(product.featured_desktop_image) ?? mobileImageUrl;
            const categoryUnit = categoryMap.get(product.category_id)?.unit;
            const hasUnitInWeight =
              typeof product.weight === "string" && /[а-яa-z]/i.test(product.weight);
            const weightDisplay = product.weight
              ? hasUnitInWeight || !categoryUnit
                ? product.weight
                : `${product.weight} ${categoryUnit}`
              : null;
            return (
              <div
                key={product.id}
                onClick={() => {
                  if (suppressClickRef.current) return;
                  onProductClick(product);
                }}
                className="relative w-full h-full flex-shrink-0 cursor-pointer active:scale-[0.99] transition-transform"
                style={mobileImageUrl ? { backgroundColor: "#EAEAEA" } : PHOTO_PLACEHOLDER_STYLE}
              >
                {mobileImageUrl && (
                  <Image
                    src={mobileImageUrl}
                    alt={product.name}
                    fill
                    className="object-cover pointer-events-none select-none md:hidden"
                    sizes="100vw"
                    unoptimized
                    draggable={false}
                  />
                )}
                {desktopImageUrl && (
                  <Image
                    src={desktopImageUrl}
                    alt={product.name}
                    fill
                    className="object-cover pointer-events-none select-none hidden md:block"
                    sizes="1200px"
                    unoptimized
                    draggable={false}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent md:bg-gradient-to-r md:from-black/50 md:via-black/20 md:to-transparent pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-10 md:inset-y-0 md:right-auto md:max-w-[50%] md:flex md:flex-col md:justify-end md:p-8">
                  <h2
                    className="text-white leading-[1.05] [text-shadow:0_1px_2px_rgba(0,0,0,0.25)] text-[32px] md:text-[40px]"
                    style={{ fontWeight: 500 }}
                  >
                    {product.name}
                  </h2>
                  {product.featured_text && (
                    <p className="text-white/85 mt-2 leading-snug line-clamp-2 text-[13px] md:text-[15px]">
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
                <div
                  className="absolute bottom-5 right-5 md:bottom-8 md:right-8 z-10"
                  onClick={stopPointer}
                >
                  <FavoriteButton product={product} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Точки-индикатор: левый верхний угол */}
        {total > 1 && (
          <div className="absolute top-4 left-4 flex gap-1.5 z-10">
            {products.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Слайд ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(i);
                }}
                className={`rounded-full transition-all duration-300 ring-1 ring-black/15 ${
                  i === activeIndex ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/55"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
