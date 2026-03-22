"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
      <div className="relative aspect-square bg-[#EAEAEA] mx-4 rounded-[20px] overflow-hidden">
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
      <div className="px-4 py-4">
        <h2 className="text-[22px] font-bold text-black">{product.name}</h2>

        <div className="flex items-baseline gap-3 mt-2">
          <span className="text-[20px] font-semibold text-black">
            {price.toLocaleString("ru-RU")} ₽
          </span>
          {product.weight && (
            <span className="text-[14px] text-[#8E8E93]">{product.weight}</span>
          )}
        </div>

        {/* КБЖУ */}
        {(product.calories || product.proteins || product.fats || product.carbs) && (
          <div className="mt-4 pt-4 pb-4 border-t border-b border-gray-100">
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

        {product.description && (
          <p className="text-[15px] text-gray-600 mt-3 leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Состав */}
        {product.ingredients && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-[14px] font-semibold text-black mb-2">Состав</h3>
            <p className="text-[14px] text-gray-600 leading-relaxed">
              {product.ingredients}
            </p>
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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<"horizontal" | "vertical" | null>(null);

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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setSwipeOffset(0);
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

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTransitioning) return;
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setSwipeDirection(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isTransitioning || !touchStart) return;

    const touch = e.touches[0];
    const diffX = touch.clientX - touchStart.x;
    const diffY = touch.clientY - touchStart.y;

    if (!swipeDirection && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
      setSwipeDirection(Math.abs(diffX) > Math.abs(diffY) ? "horizontal" : "vertical");
    }

    if (swipeDirection === "horizontal") {
      // Resistance at edges
      if ((diffX > 0 && !hasPrev) || (diffX < 0 && !hasNext)) {
        setSwipeOffset(diffX * 0.2);
      } else {
        setSwipeOffset(diffX);
      }
    }
  };

  const handleTouchEnd = () => {
    if (isTransitioning || !touchStart) {
      setTouchStart(null);
      setSwipeDirection(null);
      return;
    }

    const offset = swipeOffset;
    setTouchStart(null);
    setSwipeDirection(null);

    if (Math.abs(offset) > minSwipeDistance) {
      if (offset > 0 && hasPrev) {
        goToPrev();
        return;
      } else if (offset < 0 && hasNext) {
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
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isAnimating ? "opacity-50" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Navigation dots */}
      {products.length > 1 && products.length <= 20 && (
        <div
          className={`absolute left-0 right-0 flex justify-center gap-1.5 transition-all duration-300 ${
            isAnimating ? "bottom-[91vh]" : "bottom-0 opacity-0"
          }`}
          style={{ marginBottom: "12px" }}
        >
          {products.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onProductChange(p)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      )}

      {/* Modal Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-[20px] h-[91vh] overflow-hidden transform transition-transform duration-300 ease-out ${
          isAnimating ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
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
          className="h-[calc(91vh-40px)] overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
