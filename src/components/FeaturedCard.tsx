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

const AUTO_PLAY_MS = 7000;
const TRANSITION = "transform 0.9s cubic-bezier(0.22, 1, 0.36, 1)";

export function FeaturedCard({ products, categoryMap, onProductClick }: FeaturedCardProps) {
  const total = products.length;

  // Виртуальный индекс по массиву с клонами:
  // [clone(last), p0, p1, ..., p(N-1), clone(first)]
  // 0 = клон последнего, 1..N = реальные слайды, N+1 = клон первого.
  // Стартуем с 1 (первый реальный слайд).
  const [vIndex, setVIndex] = useState(1);
  const [noTransition, setNoTransition] = useState(false);
  // Драг ведём через refs и пишем transform напрямую в DOM:
  // setState на каждый pointermove ре-рендерил все слайды и ронял FPS.
  const dragOffsetRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalSwipeRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Слайды с клонами для seamless-обёртки. Если 0 или 1 слайд — без клонов.
  const slides = total > 1
    ? [products[total - 1], ...products, products[0]]
    : products;

  // Реальный индекс для точек-индикатора (0..N-1)
  const realIndex = total > 1 ? ((vIndex - 1) + total) % total : 0;

  // Авто-листание раз в 7 секунд
  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => {
      setNoTransition(false);
      // Не идти дальше клона первого — иначе при скрытой вкладке vIndex уходит в бесконечность
      setVIndex((i) => (i <= total ? i + 1 : i));
    }, AUTO_PLAY_MS);
    return () => clearInterval(t);
  }, [total, vIndex]);

  // По окончании анимации — если мы на клоне, мгновенно прыгаем на реальный слайд.
  const handleTransitionEnd = () => {
    if (total <= 1) return;
    if (vIndex === 0) {
      // Прыжок на реальный последний слайд без анимации
      setNoTransition(true);
      setVIndex(total);
    } else if (vIndex === total + 1) {
      setNoTransition(true);
      setVIndex(1);
    }
  };

  // После «безшумного» прыжка — снова включаем анимацию.
  // setTimeout(50) надёжнее двойного rAF: даёт браузеру гарантированно применить позицию.
  useEffect(() => {
    if (!noTransition) return;
    const t = setTimeout(() => setNoTransition(false), 50);
    return () => clearTimeout(t);
  }, [noTransition, vIndex]);

  // При возврате на вкладку нормализуем vIndex, если он ушёл за границы пока вкладка была скрыта
  useEffect(() => {
    if (total <= 1) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setVIndex(i => {
        if (i <= 0) return total;
        if (i > total + 1) return ((i - 1) % total) + 1;
        return i;
      });
      setNoTransition(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [total]);

  // Pointer events работают и на тач, и на мышь.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    touchStartRef.current = { x: e.clientX, y: e.clientY };
    isHorizontalSwipeRef.current = false;
    dragOffsetRef.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = touchStartRef.current;
    if (start == null) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!isHorizontalSwipeRef.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        isHorizontalSwipeRef.current = true;
      } else if (Math.abs(dy) > 8) {
        touchStartRef.current = null;
        return;
      }
    }
    if (isHorizontalSwipeRef.current || Math.abs(dx) > Math.abs(dy)) {
      dragOffsetRef.current = dx;
      if (trackRef.current) {
        trackRef.current.style.transition = "none";
        trackRef.current.style.transform = `translateX(calc(${-vIndex * 100}% + ${dx}px))`;
      }
    }
  };

  const handlePointerEnd = () => {
    if (touchStartRef.current == null) return;
    const offset = dragOffsetRef.current;
    touchStartRef.current = null;
    dragOffsetRef.current = 0;
    isHorizontalSwipeRef.current = false;
    if (trackRef.current) {
      trackRef.current.style.transition = TRANSITION;
      trackRef.current.style.transform = `translateX(${-vIndex * 100}%)`;
    }
    if (Math.abs(offset) > 50 && total > 1) {
      suppressClickRef.current = true;
      setTimeout(() => {
        suppressClickRef.current = false;
      }, 300);
      setNoTransition(false);
      if (offset < 0) setVIndex((i) => i + 1);
      else setVIndex((i) => i - 1);
    }
  };

  const handleDotClick = (i: number) => {
    setNoTransition(false);
    setVIndex(i + 1); // i — реальный индекс, +1 потому что клон последнего стоит на 0
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
          ref={trackRef}
          className="absolute inset-0 flex"
          style={{
            willChange: "transform",
            transform: `translateX(${-vIndex * 100}%)`,
            transition: noTransition ? "none" : TRANSITION,
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.map((product, slideIdx) => {
            const price = parseFloat(product.base_price);
            const defaultImageUrl = getProductImageUrl(product);
            const mobileImageUrl =
              prefixMediaUrl(product.featured_mobile_image) ?? defaultImageUrl;
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
                key={`${product.id}-${slideIdx}`}
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent md:hidden pointer-events-none" />
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
                  handleDotClick(i);
                }}
                className={`rounded-full transition-all duration-300 ring-1 ring-black/15 ${
                  i === realIndex ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/55"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
