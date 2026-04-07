"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Product } from "@/lib/types";

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
  const price = parseFloat(product.base_price);

  // Формируем строку веса с единицей измерения
  const weightDisplay = useMemo(() => {
    if (!product.weight) return null;
    // Если в weight уже есть единица (старый формат), показываем как есть
    if (typeof product.weight === 'string' && /[а-яa-z]/i.test(product.weight)) {
      return product.weight;
    }
    // Иначе добавляем единицу из категории
    return categoryUnit ? `${product.weight} ${categoryUnit}` : product.weight;
  }, [product.weight, categoryUnit]);

  return (
    <div className="flex flex-col cursor-pointer" onClick={onClick}>
      {/* Изображение на сером фоне */}
      <div className="relative aspect-square bg-[#EAEAEA] rounded-[20px] overflow-hidden active:scale-[0.98] transition-transform">
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 50vw, 33vw"
          unoptimized
        />
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
