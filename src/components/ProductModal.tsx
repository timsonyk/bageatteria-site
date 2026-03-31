"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { Product } from "@/lib/types";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  products: Product[];
  onProductChange: (product: Product) => void;
}

// Card component for a single product
function ProductCard({
  product,
  getImageUrl,
}: {
  product: Product;
  getImageUrl: (p: Product) => string;
}) {
  const imageUrl = getImageUrl(product);
  const price = parseFloat(product.base_price);

  return (
    <div className="w-full flex-shrink-0">
      {/* Product Image */}
      <div className="relative aspect-square bg-[#EAEAEA] mx-6 mt-2 rounded-[20px] overflow-hidden">
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          className="object-contain pointer-events-none select-none"
          sizes="(max-width: 768px) 100vw, 50vw"
          unoptimized
          draggable={false}
        />
      </div>

      {/* Product Info */}
      <div className="px-4 pt-4" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        <h2 className="text-[22px] font-bold text-black">{product.name}</h2>

        <div className="flex items-baseline gap-3 mt-2">
          <span className="text-[20px] font-semibold text-black">
            {price.toLocaleString("ru-RU")} ₽
          </span>
          {product.weight && (
            <span className="text-[14px] text-[#8E8E93]">{product.weight}</span>
          )}
        </div>

        {/* Описание */}
        {product.description && (
          <div className="mt-3">
            <h3 className="text-[14px] font-semibold text-black mb-1">Описание</h3>
            <p className="text-[15px] text-gray-600 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>
        )}

        {/* Состав */}
        {product.ingredients && (
          <div className="mt-3">
            <h3 className="text-[14px] font-semibold text-black mb-1">Состав</h3>
            <p className="text-[14px] text-gray-600 leading-relaxed whitespace-pre-line">
              {product.ingredients}
            </p>
          </div>
        )}

        {/* КБЖУ */}
        {(product.calories || product.proteins || product.fats || product.carbs) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-[14px] font-semibold text-black mb-2">Пищевая ценность</h3>
            <div className="grid grid-cols-4 gap-2">
              {product.calories !== null && (
                <div className="text-center">
                  <div className="text-[16px] font-medium text-black">{product.calories}</div>
                  <div className="text-[12px] text-[#8E8E93]">ккал</div>
                </div>
              )}
              {product.proteins !== null && (
                <div className="text-center">
                  <div className="text-[16px] font-medium text-black">{product.proteins}</div>
                  <div className="text-[12px] text-[#8E8E93]">белки</div>
                </div>
              )}
              {product.fats !== null && (
                <div className="text-center">
                  <div className="text-[16px] font-medium text-black">{product.fats}</div>
                  <div className="text-[12px] text-[#8E8E93]">жиры</div>
                </div>
              )}
              {product.carbs !== null && (
                <div className="text-center">
                  <div className="text-[16px] font-medium text-black">{product.carbs}</div>
                  <div className="text-[12px] text-[#8E8E93]">углеводы</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProductModal({
  isOpen,
  onClose,
  product,
  products,
  onProductChange,
}: ProductModalProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [verticalOffset, setVerticalOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"horizontal" | "vertical" | null>(null);
  const [isOverscrolling, setIsOverscrolling] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:8000";
  const minSwipeDistance = 60;

  const currentIndex = product ? products.findIndex((p) => p.id === product.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < products.length - 1;

  // Get prev, current, next products for carousel
  const carouselProducts = useMemo(() => {
    if (currentIndex === -1) return [];
    const items: { product: Product; position: number }[] = [];

    if (hasPrev) {
      items.push({ product: products[currentIndex - 1], position: -1 });
    }
    items.push({ product: products[currentIndex], position: 0 });
    if (hasNext) {
      items.push({ product: products[currentIndex + 1], position: 1 });
    }

    return items;
  }, [currentIndex, hasPrev, hasNext, products]);

  // Helper to get image URL from product
  const getImageUrl = useCallback((p: Product): string => {
    const mediaItem = p.media?.[0];
    const mediaUrl = typeof mediaItem === "string" ? mediaItem : mediaItem?.url;
    if (!mediaUrl) return "/placeholder.svg";
    if (mediaUrl.startsWith("http")) return mediaUrl;
    return `${MEDIA_URL}${mediaUrl}`;
  }, [MEDIA_URL]);

  // Preload adjacent images
  useEffect(() => {
    if (!isOpen || currentIndex === -1) return;

    const preloadImage = (url: string) => {
      const img = new window.Image();
      img.src = url;
    };

    if (hasPrev) {
      preloadImage(getImageUrl(products[currentIndex - 1]));
    }
    if (hasNext) {
      preloadImage(getImageUrl(products[currentIndex + 1]));
    }
  }, [isOpen, currentIndex, hasPrev, hasNext, products, getImageUrl]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      // Animate to show prev card
      setSwipeOffset(window.innerWidth);
      setTimeout(() => {
        onProductChange(products[currentIndex - 1]);
        setSwipeOffset(0);
        setIsTransitioning(false);
      }, 250);
    }
  }, [currentIndex, products, onProductChange, isTransitioning]);

  const goToNext = useCallback(() => {
    if (currentIndex < products.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      // Animate to show next card
      setSwipeOffset(-window.innerWidth);
      setTimeout(() => {
        onProductChange(products[currentIndex + 1]);
        setSwipeOffset(0);
        setIsTransitioning(false);
      }, 250);
    }
  }, [currentIndex, products, onProductChange, isTransitioning]);

  // Animation handling
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(false);
      // Force browser to paint the initial state before animating
      const timer = setTimeout(() => {
        setIsAnimating(true);
      }, 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setSwipeOffset(0);
        setVerticalOffset(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, goToPrev, goToNext]);

  // Touch handlers for handle (close gesture)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTransitioning) return;
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setSwipeDirection(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isTransitioning || !touchStart) return;

    const touch = e.touches[0];
    const diffY = touch.clientY - touchStart.y;

    // Only allow swiping down (positive diffY)
    if (diffY > 0) {
      setVerticalOffset(diffY);
    }
  };

  const handleTouchEnd = () => {
    if (isTransitioning || !touchStart) {
      setTouchStart(null);
      return;
    }

    const vOffset = verticalOffset;
    setTouchStart(null);

    // Handle vertical swipe (close on swipe down)
    if (vOffset > 100) {
      onClose();
      setVerticalOffset(0);
      return;
    } else {
      // Snap back
      setIsTransitioning(true);
      setVerticalOffset(0);
      setTimeout(() => setIsTransitioning(false), 250);
    }
  };

  // Touch handlers for carousel (horizontal swipe + overscroll to close)
  const handleCarouselTouchStart = (e: React.TouchEvent) => {
    if (isTransitioning) return;
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setSwipeDirection(null);
    setIsOverscrolling(false);
  };

  const handleCarouselTouchMove = (e: React.TouchEvent) => {
    if (isTransitioning || !touchStart) return;

    const touch = e.touches[0];
    const diffX = touch.clientX - touchStart.x;
    const diffY = touch.clientY - touchStart.y;

    // Check if we're at the top of scroll and pulling down
    const scrollContainer = scrollContainerRef.current;
    const isAtTop = scrollContainer ? scrollContainer.scrollTop <= 0 : true;

    if (!swipeDirection && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
      // If at top and pulling down, start overscroll
      if (isAtTop && diffY > 0 && Math.abs(diffY) > Math.abs(diffX)) {
        setSwipeDirection("vertical");
        setIsOverscrolling(true);
      } else {
        setSwipeDirection(Math.abs(diffX) > Math.abs(diffY) ? "horizontal" : "vertical");
      }
    }

    if (swipeDirection === "horizontal") {
      // Resistance at edges
      if ((diffX > 0 && !hasPrev) || (diffX < 0 && !hasNext)) {
        setSwipeOffset(diffX * 0.2);
      } else {
        setSwipeOffset(diffX);
      }
    } else if (swipeDirection === "vertical" && isOverscrolling && diffY > 0) {
      // Overscroll to close
      e.preventDefault();
      setVerticalOffset(diffY);
    }
  };

  const handleCarouselTouchEnd = () => {
    if (isTransitioning || !touchStart) {
      setTouchStart(null);
      setSwipeDirection(null);
      setIsOverscrolling(false);
      return;
    }

    const hOffset = swipeOffset;
    const vOffset = verticalOffset;
    setTouchStart(null);
    setSwipeDirection(null);

    // Handle overscroll close
    if (isOverscrolling && vOffset > 100) {
      onClose();
      setVerticalOffset(0);
      setIsOverscrolling(false);
      return;
    }

    if (isOverscrolling) {
      setIsTransitioning(true);
      setVerticalOffset(0);
      setIsOverscrolling(false);
      setTimeout(() => setIsTransitioning(false), 250);
      return;
    }

    // Handle horizontal swipe (navigate between products)
    if (Math.abs(hOffset) > minSwipeDistance) {
      if (hOffset > 0 && hasPrev) {
        goToPrev();
        return;
      } else if (hOffset < 0 && hasNext) {
        goToNext();
        return;
      }
    }

    // Snap back
    setIsTransitioning(true);
    setSwipeOffset(0);
    setTimeout(() => setIsTransitioning(false), 250);
  };

  if (!isVisible || !product) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black"
        style={{
          opacity: isAnimating ? Math.max(0, 0.5 - verticalOffset / 400) : 0,
          transition: (isTransitioning || !isAnimating || verticalOffset === 0)
            ? "opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1)"
            : "none",
        }}
        onClick={onClose}
      />

      {/* Navigation dots */}
      {products.length > 1 && (
        <div
          className="absolute left-0 right-0 flex justify-center z-20 pointer-events-none"
          style={{
            top: isAnimating ? "12px" : "100%",
            opacity: isAnimating ? 1 : 0,
            transition: "top 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          <div className="flex items-center gap-1.5">
            {(() => {
              const total = products.length;
              const maxDots = 11;

              if (total <= maxDots) {
                // Показываем все точки если их мало
                return products.map((_, i) => (
                  <span
                    key={i}
                    className={`rounded-full transition-all duration-200 ${
                      i === currentIndex
                        ? "w-2.5 h-2.5 bg-white"
                        : "w-2 h-2 bg-white/40"
                    }`}
                  />
                ));
              }

              // Для большого количества - скользящее окно
              const dots: React.ReactNode[] = [];
              const sideCount = Math.floor((maxDots - 1) / 2); // точек с каждой стороны от текущей

              let start = currentIndex - sideCount;
              let end = currentIndex + sideCount;

              // Корректируем границы
              if (start < 0) {
                end -= start;
                start = 0;
              }
              if (end >= total) {
                start -= (end - total + 1);
                end = total - 1;
              }
              start = Math.max(0, start);

              for (let i = start; i <= end; i++) {
                const distanceFromEdge = Math.min(i - start, end - i);

                // Уменьшаем крайние точки
                let sizeClass = "w-2 h-2";
                if (i === currentIndex) {
                  sizeClass = "w-2.5 h-2.5";
                } else if (distanceFromEdge === 0 && (start > 0 || end < total - 1)) {
                  sizeClass = "w-1.5 h-1.5";
                }

                dots.push(
                  <span
                    key={i}
                    className={`rounded-full transition-all duration-200 ${sizeClass} ${
                      i === currentIndex ? "bg-white" : "bg-white/40"
                    }`}
                  />
                );
              }

              return dots;
            })()}
          </div>
        </div>
      )}

      {/* Modal Sheet */}
      <div
        className="absolute inset-x-0 bottom-0 bg-white rounded-t-[20px] overflow-hidden transform"
        style={{
          top: "44px",
          transform: isAnimating
            ? `translateY(${verticalOffset}px)`
            : "translateY(100%)",
          transition: (isTransitioning || !isAnimating || verticalOffset === 0)
            ? "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)"
            : "none",
        }}
      >
        {/* Handle - draggable area */}
        <div
          className="flex justify-center pt-3 pb-4 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Swipeable Carousel */}
        <div
          className="h-[calc(100%-40px)] overflow-hidden"
          onTouchStart={handleCarouselTouchStart}
          onTouchMove={handleCarouselTouchMove}
          onTouchEnd={handleCarouselTouchEnd}
        >
          <div
            className="flex h-full"
            style={{
              transform: `translateX(calc(-${hasPrev ? 100 : 0}% + ${swipeOffset}px))`,
              transition: isTransitioning ? "transform 0.25s ease-out" : "none",
            }}
          >
            {carouselProducts.map(({ product: p, position }) => (
              <div
                key={p.id}
                ref={position === 0 ? scrollContainerRef : undefined}
                className="w-full flex-shrink-0 h-full overflow-y-auto overscroll-contain"
              >
                <ProductCard product={p} getImageUrl={getImageUrl} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
