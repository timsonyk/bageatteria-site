"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Product } from "@/lib/types";
import { FavoriteButton } from "./FavoriteButton";

interface ProductCardProps {
  product: Product;
  categoryUnit?: string;
  onClick?: () => void;
}

export function ProductCard({ product, categoryUnit, onClick }: ProductCardProps) {
  const mediaItem = product.media?.[0];
  // media может быть массивом строк или объектов с url
  const mediaUrl = typeof mediaItem === 'string' ? mediaItem : mediaItem?.url;
  const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:8000";

  // Обработка URL изображения
  let imageUrl = "/placeholder.svg";
  if (mediaUrl) {
    if (mediaUrl.startsWith('http')) {
      imageUrl = mediaUrl;
    } else {
      imageUrl = `${MEDIA_URL}${mediaUrl}`;
    }
  }
  const hasSizes = product.sizes && product.sizes.length > 0;
  const defaultSize = useMemo(() => {
    if (!hasSizes) return null;
    const sorted = [...product.sizes!].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.length >= 3 ? 1 : 0;
    return sorted[idx];
  }, [hasSizes, product.sizes]);
  const price = defaultSize ? parseFloat(defaultSize.base_price) : parseFloat(product.base_price);

  // Формируем строку веса с единицей измерения
  const weightDisplay = useMemo(() => {
    // Если есть размеры — берём volume из дефолтного размера
    if (defaultSize?.volume) {
      return categoryUnit ? `${defaultSize.volume} ${categoryUnit}` : defaultSize.volume;
    }
    if (!product.weight) return null;
    // Если в weight уже есть единица (старый формат), показываем как есть
    if (typeof product.weight === 'string' && /[а-яa-z]/i.test(product.weight)) {
      return product.weight;
    }
    // Иначе добавляем единицу из категории
    return categoryUnit ? `${product.weight} ${categoryUnit}` : product.weight;
  }, [product.weight, categoryUnit, defaultSize]);

  return (
    <div className="flex flex-col cursor-pointer" onClick={onClick}>
      {/* Изображение на сером фоне */}
      <div className="relative aspect-square bg-[#EAEAEA] rounded-[20px] active:scale-[0.98] transition-transform">
        <div className="absolute inset-0 overflow-hidden rounded-[20px]">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 50vw, 33vw"
            unoptimized
          />
        </div>
        <div className="absolute bottom-2 right-2 z-10">
          <FavoriteButton product={product} />
        </div>
      </div>

      {/* Контент под изображением */}
      <div className="flex flex-col mt-2 pl-1.5">
        {/* Название */}
        <h3 className="text-[16px] font-medium text-black leading-none -ml-px">
          {product.name}
        </h3>

        {/* Цена */}
        <span className="text-[14px] font-normal text-black leading-snug mt-1">
          {price.toLocaleString("ru-RU")} ₽
        </span>

        {/* Вес и калории */}
        {(weightDisplay || product.calories) && (
          <p className="text-[13px] text-[#8E8E93] leading-snug mt-0.5">
            {[
              weightDisplay,
              product.calories ? `${product.calories} ккал` : null
            ].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
