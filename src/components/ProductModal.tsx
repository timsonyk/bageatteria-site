"use client";

import { useEffect, useState, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import Image from "next/image";
import { Heart, Minus, Plus } from "lucide-react";
import { Product, Category, ModificationGroup, ModificationOption } from "@/lib/types";
import { useFavorites } from "@/contexts/FavoritesContext";
import { PHOTO_PLACEHOLDER_STYLE } from "@/lib/media";
import { ExpandableText } from "./ExpandableText";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  products: Product[];
  categories: Category[];
  onProductChange: (product: Product) => void;
  onOpenFavorites?: () => void;
}

// Card component for a single product
function ProductCard({
  product,
  getImageUrl,
  categoryUnit,
  onOpenFavorites,
}: {
  product: Product;
  getImageUrl: (p: Product) => string | null;
  categoryUnit?: string;
  onOpenFavorites?: () => void;
}) {
  const imageUrl = getImageUrl(product);
  const sortedSizes = useMemo(() => {
    if (!product.sizes || product.sizes.length === 0) return [];
    return [...product.sizes].sort((a, b) => a.sort_order - b.sort_order).slice(0, 3);
  }, [product.sizes]);
  const defaultSizeIndex = sortedSizes.length >= 3 ? 1 : 0;
  const [selectedSizeIndex, setSelectedSizeIndex] = useState(defaultSizeIndex);
  const sizeButtonsRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [sizeIndicator, setSizeIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const btn = sizeButtonsRef.current.get(selectedSizeIndex);
    if (btn) {
      setSizeIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [selectedSizeIndex, sortedSizes]);

  // Modifications
  const modGroups = useMemo(() => {
    if (!product.modification_groups || product.modification_groups.length === 0) return [];
    return [...product.modification_groups]
      .filter(g => g.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(g => ({
        ...g,
        options: g.options.filter(o => o.is_active).sort((a, b) => a.sort_order - b.sort_order),
      }));
  }, [product.modification_groups]);

  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(() => {
    const defaults = new Set<number>();
    modGroups.forEach(g => g.options.forEach(o => { if (o.is_default) defaults.add(o.id); }));
    return defaults;
  });

  const toggleOption = useCallback((group: ModificationGroup, option: ModificationOption) => {
    setSelectedOptions(prev => {
      const next = new Set(prev);
      if (group.type === "single") {
        // Убираем все опции этой группы, ставим новую
        group.options.forEach(o => next.delete(o.id));
        next.add(option.id);
      } else {
        // multiple: toggle
        if (next.has(option.id)) {
          next.delete(option.id);
        } else {
          // Проверяем max_count
          const selectedInGroup = group.options.filter(o => next.has(o.id)).length;
          if (selectedInGroup < group.max_count) {
            next.add(option.id);
          }
        }
      }
      return next;
    });
  }, [modGroups]);

  const modsExtra = useMemo(() => {
    let sum = 0;
    modGroups.forEach(g => g.options.forEach(o => {
      if (selectedOptions.has(o.id)) sum += parseFloat(o.extra_price);
    }));
    return sum;
  }, [modGroups, selectedOptions]);

  const hasSizes = sortedSizes.length > 0;
  const basePrice = hasSizes
    ? parseFloat(sortedSizes[selectedSizeIndex]?.base_price ?? product.base_price)
    : parseFloat(product.base_price);
  const price = basePrice + modsExtra;

  // Динамический КБЖУ.
  //   Базовый путь: per_100g продукта × volume_ml выбранного размера / 100.
  //   Выбранная опция с per_100g — ПОЛНОСТЬЮ заменяет per_100g продукта
  //     (это КБЖУ готового продукта С ЭТОЙ МОДИФИКАЦИЕЙ, на 100 г).
  //   Если per_100g не задан — fallback на per-portion (ProductSize или Product).
  const dynamicKbju = useMemo(() => {
    const currentSize = hasSizes ? sortedSizes[selectedSizeIndex] : null;
    // Нормализуем вес/объём в базовые единицы (г или мл).
    // ProductSize.volume_ml всегда уже в мл.
    // product.weight может быть числом в единицах категории (г / кг / мл / л).
    const parseWeight = (): number | null => {
      if (!product.weight) return null;
      const raw = parseFloat(String(product.weight).replace(",", "."));
      if (!Number.isFinite(raw)) return null;
      const unit = (categoryUnit || "").toLowerCase();
      if (unit === "кг" || unit === "л") return raw * 1000;
      return raw;
    };
    const volume = (currentSize && currentSize.volume_ml) || parseWeight();

    // Base per-100g: из продукта (или переопределённое выбранной опцией)
    let kcal100 = product.calories_per_100g;
    let prot100 = product.proteins_per_100g;
    let fat100 = product.fats_per_100g;
    let carb100 = product.carbs_per_100g;

    // Per-100g replacement from selected options (берём ПОСЛЕДНЕЕ найденное)
    modGroups.forEach((g) =>
      g.options.forEach((o) => {
        if (!selectedOptions.has(o.id)) return;
        if (o.calories_per_100g != null) kcal100 = o.calories_per_100g;
        if (o.proteins_per_100g != null) prot100 = o.proteins_per_100g;
        if (o.fats_per_100g != null) fat100 = o.fats_per_100g;
        if (o.carbs_per_100g != null) carb100 = o.carbs_per_100g;
      })
    );

    // Считаем per-portion из per-100g × volume / 100 (если всё есть)
    const fromPer100 = (v: number | null | undefined) =>
      v != null && volume ? (v * volume) / 100 : null;

    let kcal: number | null | undefined = fromPer100(kcal100);
    let prot: number | null | undefined = fromPer100(prot100);
    let fat: number | null | undefined = fromPer100(fat100);
    let carb: number | null | undefined = fromPer100(carb100);

    // Fallback на legacy per-portion если per-100g не задано
    const pickFallback = (s: number | null | undefined, p: number | null | undefined) =>
      s != null ? s : p;
    if (kcal == null) kcal = pickFallback(currentSize?.calories, product.calories);
    if (prot == null) prot = pickFallback(currentSize?.proteins, product.proteins);
    if (fat == null) fat = pickFallback(currentSize?.fats, product.fats);
    if (carb == null) carb = pickFallback(currentSize?.carbs, product.carbs);

    // Абсолютная дельта от выбранных опций (для добавок типа «+1 яйцо»).
    // Применяется только если у опции НЕ задан per-100g (тогда per-100g уже сработал выше).
    const addAbs = (
      base: number | null | undefined,
      delta: number | null | undefined,
    ) => (base == null || delta == null ? base : base + delta);
    modGroups.forEach((g) =>
      g.options.forEach((o) => {
        if (!selectedOptions.has(o.id)) return;
        if (o.calories_per_100g == null) kcal = addAbs(kcal, o.calories);
        if (o.proteins_per_100g == null) prot = addAbs(prot, o.proteins);
        if (o.fats_per_100g == null) fat = addAbs(fat, o.fats);
        if (o.carbs_per_100g == null) carb = addAbs(carb, o.carbs);
      })
    );

    const clamp1 = (v: number | null | undefined) =>
      v == null ? null : Math.round(Math.max(0, v) * 10) / 10;
    return {
      calories: kcal != null ? Math.max(0, Math.round(kcal)) : null,
      proteins: clamp1(prot),
      fats: clamp1(fat),
      carbs: clamp1(carb),
    };
  }, [hasSizes, sortedSizes, selectedSizeIndex, product, categoryUnit, modGroups, selectedOptions]);

  const currentSizeId = hasSizes ? sortedSizes[selectedSizeIndex]?.id ?? null : null;
  const currentOptionIds = useMemo(
    () => [...selectedOptions].sort((a, b) => a - b),
    [selectedOptions]
  );

  const { getVariantQty, getProductQty, addVariant, decrementVariant } = useFavorites();
  const qty = getVariantQty(product.id, currentSizeId, currentOptionIds);
  const productQty = getProductQty(product.id);

  // Формируем строку веса с единицей измерения
  const weightDisplay = useMemo(() => {
    // Если выбран размер с volume, показываем его
    if (hasSizes && sortedSizes[selectedSizeIndex]?.volume) {
      return sortedSizes[selectedSizeIndex].volume;
    }
    if (!product.weight) return null;
    // Если в weight уже есть единица (старый формат), показываем как есть
    if (typeof product.weight === 'string' && /[а-яa-z]/i.test(product.weight)) {
      return product.weight;
    }
    // Иначе добавляем единицу из категории
    return categoryUnit ? `${product.weight} ${categoryUnit}` : product.weight;
  }, [product.weight, categoryUnit, hasSizes, sortedSizes, selectedSizeIndex]);

  return (
    <div className="w-full flex-shrink-0 flex flex-col min-h-full">
      <div className="flex-1">
      {/* Product Image */}
      <div
        className="relative aspect-square mx-4 rounded-[20px] overflow-hidden"
        style={imageUrl ? { backgroundColor: "#EAEAEA" } : PHOTO_PLACEHOLDER_STYLE}
      >
        {imageUrl && (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-contain pointer-events-none select-none"
            sizes="(max-width: 768px) 100vw, 50vw"
            unoptimized
            draggable={false}
          />
        )}
      </div>

      {/* Product Info */}
      <div className="px-4 pt-4 pb-4">
        <h2 className="text-[22px] font-bold text-black">{product.name}</h2>

        {/* Size Selector */}
        {hasSizes && (
          <div className="mt-3">
            <div className="relative bg-[#F2F2F7] rounded-[10px] p-1 flex">
              {/* Animated indicator */}
              <div
                className="absolute top-1 bottom-1 bg-white rounded-[8px] transition-all duration-300 ease-out"
                style={{
                  left: sizeIndicator.left,
                  width: sizeIndicator.width,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                }}
              />
              {sortedSizes.map((size, index) => {
                const isSelected = index === selectedSizeIndex;
                return (
                  <button
                    key={size.id}
                    ref={(el) => { if (el) sizeButtonsRef.current.set(index, el); }}
                    onClick={() => setSelectedSizeIndex(index)}
                    className="relative z-10 flex-1 flex flex-col items-center justify-center py-2.5"
                  >
                    <span
                      className="text-[20px] transition-colors duration-200"
                      style={{
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? '#000000' : '#8E8E93',
                      }}
                    >
                      {size.name}
                    </span>
                    {size.volume && (
                      <span
                        className="text-[11px] mt-0.5 transition-colors duration-200"
                        style={{ color: '#8E8E93' }}
                      >
                        {size.volume}{categoryUnit ? ` ${categoryUnit}` : ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-baseline gap-3 mt-2 ml-1">
          <span className="text-[20px] font-semibold text-black">
            {price.toLocaleString("ru-RU")} ₽
          </span>
          {weightDisplay && sortedSizes.length <= 1 && (
            <span className="text-[14px] text-[#8E8E93]">{weightDisplay}</span>
          )}
        </div>

        {/* Описание */}
        {product.description && (
          <div className="mt-3">
            <h3 className="text-[14px] font-semibold text-black mb-1">Описание</h3>
            <ExpandableText
              text={product.description}
              className="text-[15px] text-gray-600 leading-relaxed"
              lines={2}
            />
          </div>
        )}

        {/* Состав */}
        {product.ingredients && (
          <div className="mt-3">
            <h3 className="text-[14px] font-semibold text-black mb-1">Состав</h3>
            <ExpandableText
              text={product.ingredients}
              className="text-[14px] text-gray-600 leading-relaxed"
              lines={2}
            />
          </div>
        )}

        {/* КБЖУ (динамический — зависит от размера и модификаций) */}
        {(dynamicKbju.calories != null || dynamicKbju.proteins != null || dynamicKbju.fats != null || dynamicKbju.carbs != null) && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-[14px] font-semibold text-black mb-2">Пищевая ценность</h3>
            <div className="grid grid-cols-4 gap-2">
              {dynamicKbju.calories != null && (
                <div className="text-center">
                  <div className="text-[16px] font-medium text-black tabular-nums">{dynamicKbju.calories}</div>
                  <div className="text-[12px] text-[#8E8E93]">ккал</div>
                </div>
              )}
              {dynamicKbju.proteins != null && (
                <div className="text-center">
                  <div className="text-[16px] font-medium text-black tabular-nums">{dynamicKbju.proteins}</div>
                  <div className="text-[12px] text-[#8E8E93]">белки</div>
                </div>
              )}
              {dynamicKbju.fats != null && (
                <div className="text-center">
                  <div className="text-[16px] font-medium text-black tabular-nums">{dynamicKbju.fats}</div>
                  <div className="text-[12px] text-[#8E8E93]">жиры</div>
                </div>
              )}
              {dynamicKbju.carbs != null && (
                <div className="text-center">
                  <div className="text-[16px] font-medium text-black tabular-nums">{dynamicKbju.carbs}</div>
                  <div className="text-[12px] text-[#8E8E93]">углеводы</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Модификации */}
        {modGroups.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {modGroups.map(group => (
              <div key={group.id} className="mb-4 last:mb-0">
                <h3 className="text-[14px] font-semibold text-black mb-2">{group.name}</h3>
                <div className="grid grid-cols-3 gap-2">
                  {group.options.map(option => {
                    const isSelected = selectedOptions.has(option.id);
                    const extraPrice = parseFloat(option.extra_price);
                    const imgUrl = option.image_url
                      ? (option.image_url.startsWith('http') ? option.image_url : `${process.env.NEXT_PUBLIC_MEDIA_URL || 'http://localhost:8000'}${option.image_url}`)
                      : null;
                    return (
                      <button
                        key={option.id}
                        onClick={() => toggleOption(group, option)}
                        className="flex flex-col items-center rounded-[14px] p-2 pb-3 transition-all duration-200"
                        style={{
                          backgroundColor: isSelected ? '#FFFFFF' : '#F2F2F7',
                          boxShadow: isSelected ? '0 0 0 2px #8E8E93' : 'none',
                        }}
                      >
                        {imgUrl && (
                          <div className="relative w-full aspect-square mb-1.5 rounded-[10px] overflow-hidden">
                            <Image
                              src={imgUrl}
                              alt={option.name}
                              fill
                              className="object-contain"
                              sizes="100px"
                              unoptimized
                            />
                          </div>
                        )}
                        <span className="text-[12px] text-center leading-tight text-black" style={{ fontWeight: isSelected ? 600 : 400 }}>
                          {option.name}
                        </span>
                        {extraPrice > 0 && (
                          <span className="text-[11px] text-[#8E8E93] mt-0.5">
                            +{extraPrice.toLocaleString("ru-RU")} ₽
                          </span>
                        )}
                        <div className="mt-1.5 w-5 h-5 flex items-center justify-center">
                          {isSelected ? (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                              <path d="M5 9l3 3 5-5" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                              <path d="M9 4v10M4 9h10" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
      {/* Sticky bottom bar */}
      <div
        className="sticky bottom-0 bg-white px-4 pt-3"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center">
          {qty === 0 ? (
            <button
              type="button"
              onClick={() => addVariant(product.id, currentSizeId, currentOptionIds)}
              className="flex-1 h-14 rounded-full bg-[#E5E5EA] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <span className="text-[17px] font-semibold text-black">
                {price.toLocaleString("ru-RU")} ₽
              </span>
              <Plus className="w-5 h-5 text-black" strokeWidth={2} />
            </button>
          ) : (
            <div className="flex-1 h-14 rounded-full bg-[#E5E5EA] flex items-center justify-between px-2">
              <button
                type="button"
                aria-label="Уменьшить"
                onClick={() => decrementVariant(product.id, currentSizeId, currentOptionIds)}
                className="w-12 h-12 flex items-center justify-center active:scale-[0.9] transition-transform"
              >
                <Minus className="w-5 h-5 text-black" strokeWidth={2} />
              </button>
              <span className="text-[17px] font-semibold text-black tabular-nums">
                {qty} × {price.toLocaleString("ru-RU")} ₽
              </span>
              <button
                type="button"
                aria-label="Увеличить"
                onClick={() => addVariant(product.id, currentSizeId, currentOptionIds)}
                className="w-12 h-12 flex items-center justify-center active:scale-[0.9] transition-transform"
              >
                <Plus className="w-5 h-5 text-black" strokeWidth={2} />
              </button>
            </div>
          )}
          <button
            type="button"
            aria-label="Избранное"
            onClick={onOpenFavorites}
            className={`h-14 rounded-full bg-[#E5E5EA] flex items-center justify-center overflow-hidden transition-all duration-300 ease-out ${
              productQty > 0 ? "w-14 ml-2 opacity-100" : "w-0 ml-0 opacity-0 pointer-events-none"
            }`}
          >
            <Heart className="w-6 h-6 text-black flex-shrink-0" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductModal({
  isOpen,
  onClose,
  product,
  products,
  categories,
  onProductChange,
  onOpenFavorites,
}: ProductModalProps) {
  // Создаём карту категорий для быстрого доступа к unit
  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>();
    for (const cat of categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
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
  const getImageUrl = useCallback((p: Product): string | null => {
    const mediaItem = p.media?.[0];
    const mediaUrl = typeof mediaItem === "string" ? mediaItem : mediaItem?.url;
    if (!mediaUrl) return null;
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
      const u = getImageUrl(products[currentIndex - 1]);
      if (u) preloadImage(u);
    }
    if (hasNext) {
      const u = getImageUrl(products[currentIndex + 1]);
      if (u) preloadImage(u);
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

  // iOS Safari theme-color: серый #7c7c7b пока открыта карточка товара (только mobile)
  useEffect(() => {
    if (!isOpen || isDesktop) return;
    const meta =
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]') ??
      (() => {
        const m = document.createElement("meta");
        m.name = "theme-color";
        document.head.appendChild(m);
        return m;
      })();
    const prev = meta.getAttribute("content");
    meta.setAttribute("content", "#7c7c7b");
    return () => {
      if (prev === null) meta.remove();
      else meta.setAttribute("content", prev);
    };
  }, [isOpen, isDesktop]);

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
    <div className={`fixed inset-0 z-50 ${isDesktop ? "flex items-center justify-center" : ""}`}>
      {/* Safe-area top fill — серая плашка #7c7c7b под статус-баром iOS (только mobile) */}
      {!isDesktop && (
        <div
          className="absolute inset-x-0 top-0 pointer-events-none"
          style={{
            height: "env(safe-area-inset-top, 0px)",
            backgroundColor: "#7c7c7b",
            opacity: isAnimating ? 1 : 0,
            transition: "opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
            zIndex: 1,
          }}
        />
      )}
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

      {/* Navigation dots — только mobile (на десктопе карусели нет) */}
      {products.length > 1 && !isDesktop && (
        <div
          className="absolute left-0 right-0 flex justify-center z-20 pointer-events-none"
          style={{
            top: isAnimating ? "calc(12px + env(safe-area-inset-top, 0px))" : "100%",
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
        className={
          isDesktop
            ? "relative bg-white rounded-[20px] w-[560px] max-w-[calc(100vw-32px)] max-h-[85vh] overflow-hidden flex flex-col"
            : "absolute inset-x-0 bottom-0 bg-white rounded-t-[20px] overflow-hidden transform"
        }
        style={
          isDesktop
            ? {
                transform: isAnimating ? "none" : "scale(0.96)",
                opacity: isAnimating ? 1 : 0,
                transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
              }
            : {
                top: "max(44px, env(safe-area-inset-top, 44px))",
                transform: isAnimating
                  ? `translateY(${verticalOffset}px)`
                  : "translateY(100%)",
                transition: (isTransitioning || !isAnimating || verticalOffset === 0)
                  ? "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)"
                  : "none",
              }
        }
      >
        {/* Handle - draggable area (только mobile) */}
        {!isDesktop && (
          <div
            className="flex justify-center pt-3 pb-4 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute ${isDesktop ? "top-4 right-4" : "top-3 right-4"} p-2 rounded-full hover:bg-gray-100 transition-colors z-10`}
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

        {isDesktop ? (
          /* Desktop: одна карточка, без карусели и свайпов */
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain pt-4 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            <ProductCard
              product={product}
              getImageUrl={getImageUrl}
              categoryUnit={categoryMap.get(product.category_id)?.unit}
              onOpenFavorites={onOpenFavorites}
            />
          </div>
        ) : (
          /* Mobile: свайпы + карусель prev/current/next */
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
                  <ProductCard product={p} getImageUrl={getImageUrl} categoryUnit={categoryMap.get(p.category_id)?.unit} onOpenFavorites={onOpenFavorites} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
