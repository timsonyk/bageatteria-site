import type { CSSProperties } from "react";
import type { Product } from "./types";

/**
 * Полный URL первой фотки товара. null — если медиа нет/пустое.
 */
export function getProductImageUrl(product: Product): string | null {
  const mediaItem = product.media?.[0];
  if (!mediaItem) return null;
  const url = typeof mediaItem === "string" ? mediaItem : mediaItem.url;
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const MEDIA_URL =
    process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:8000";
  return `${MEDIA_URL}${url}`;
}

/**
 * Бежевая штриховка-заглушка для товаров без фото.
 */
export const PHOTO_PLACEHOLDER_STYLE: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 8px), linear-gradient(135deg, #E8DCC4 0%, #D8C8A8 100%)",
};
