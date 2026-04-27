"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Heart, Minus, Plus, Trash2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { Product, Category } from "@/lib/types";
import { useFavorites } from "@/contexts/FavoritesContext";
import { computeVariantPrice, variantSummaryLines } from "@/lib/favorites";
import { getProductImageUrl, PHOTO_PLACEHOLDER_STYLE } from "@/lib/media";

interface FavoritesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  availableProductIds?: Set<number>;
  categories: Category[];
  onProductClick: (product: Product) => void;
  recommendedProducts?: Product[];
}

function pluralizeTovar(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "товаров";
  if (mod10 === 1) return "товар";
  if (mod10 >= 2 && mod10 <= 4) return "товара";
  return "товаров";
}


export function FavoritesSheet({
  isOpen,
  onClose,
  products,
  availableProductIds,
  onProductClick,
  recommendedProducts = [],
}: FavoritesSheetProps) {
  const { entries, totalQty, addVariant, decrementVariant, removeEntry } = useFavorites();

  const productMap = useMemo(() => {
    const m = new Map<number, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const rows = useMemo(
    () =>
      entries
        .map((e) => {
          const product = productMap.get(e.productId);
          if (!product) return null;
          const price = computeVariantPrice(product, e.sizeId, e.optionIds);
          const summaryLines = variantSummaryLines(product, e.sizeId, e.optionIds);
          const isAvailable =
            availableProductIds === undefined || availableProductIds.has(product.id);
          return { entry: e, product, price, summaryLines, isAvailable };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [entries, productMap, availableProductIds]
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} fullHeight>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="px-4 pt-1 md:pt-5 pb-3 flex items-end justify-between flex-shrink-0">
          <h2 className="text-[28px] font-normal text-black tracking-[-0.6px] leading-none">Избранное</h2>
          {totalQty > 0 && (
            <span className="text-[14px] text-[#8E8E93] leading-none">
              {totalQty} {pluralizeTovar(totalQty)}
            </span>
          )}
        </div>

        {/* Body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 text-center py-16">
              <div className="w-16 h-16 rounded-full bg-[#F2F2F7] flex items-center justify-center mb-4">
                <Heart className="w-8 h-8 text-[#8E8E93]" strokeWidth={1.5} />
              </div>
              <p className="text-[17px] font-semibold text-black mb-1">
                Пока ничего нет
              </p>
              <p className="text-[14px] text-[#8E8E93] max-w-[240px]">
                Отмечайте понравившиеся позиции сердечком — они появятся здесь
              </p>
            </div>
          ) : (
            <ul>
              {rows.map(({ entry, product, price, summaryLines, isAvailable }) => (
                <li
                  key={entry.key}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-[#F2F2F7] last:border-b-0 transition-colors ${
                    isAvailable ? "active:bg-[#F9F9FB] cursor-pointer" : "cursor-default"
                  }`}
                  onClick={() => { if (isAvailable) onProductClick(product); }}
                >
                  <div
                    className={`relative w-[72px] h-[72px] rounded-[14px] overflow-hidden flex-shrink-0 ${
                      isAvailable ? "" : "opacity-40"
                    }`}
                    style={getProductImageUrl(product) ? { backgroundColor: "#EAEAEA" } : PHOTO_PLACEHOLDER_STYLE}
                  >
                    {getProductImageUrl(product) && (
                      <Image
                        src={getProductImageUrl(product)!}
                        alt={product.name}
                        fill
                        className="object-contain"
                        sizes="72px"
                        unoptimized
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[15px] font-semibold truncate leading-tight ${isAvailable ? "text-black" : "text-[#8E8E93]"}`}>
                      {product.name}
                    </div>
                    {isAvailable ? (
                      <>
                        {summaryLines.length > 0 && (
                          <div className="text-[13px] text-[#8E8E93] mt-0.5 leading-snug">
                            {summaryLines.map((line, i) => (
                              <div key={i} className="truncate">
                                {line}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="text-[14px] font-semibold text-black mt-1">
                          {price.toLocaleString("ru-RU")} ₽
                        </div>
                      </>
                    ) : (
                      <div className="text-[13px] text-[#FF3B30] truncate mt-0.5">
                        Нет на этой точке
                      </div>
                    )}
                  </div>
                  <div
                    className="flex-shrink-0 h-9 rounded-full bg-[#F2F2F7] flex items-center px-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label={entry.qty === 1 ? "Удалить" : "Уменьшить"}
                      onClick={() => {
                        if (entry.qty === 1) removeEntry(entry.key);
                        else decrementVariant(product.id, entry.sizeId, entry.optionIds);
                      }}
                      className="w-8 h-8 flex items-center justify-center active:scale-[0.9] transition-transform"
                    >
                      {entry.qty === 1 ? (
                        <Trash2 className="w-[16px] h-[16px] text-black" strokeWidth={1.75} />
                      ) : (
                        <Minus className="w-[16px] h-[16px] text-black" strokeWidth={2} />
                      )}
                    </button>
                    <span className="text-[14px] font-semibold text-black tabular-nums min-w-[20px] text-center">
                      {entry.qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Увеличить"
                      onClick={() => addVariant(product.id, entry.sizeId, entry.optionIds)}
                      className="w-8 h-8 flex items-center justify-center active:scale-[0.9] transition-transform"
                    >
                      <Plus className="w-[16px] h-[16px] text-black" strokeWidth={2} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {recommendedProducts.length > 0 && (
            <div className="px-4 pt-5 pb-6">
              <h3 className="text-[20px] font-medium text-black tracking-[-0.3px] leading-none mb-3">Попробуйте ещё</h3>
              <div
                className="flex gap-2.5 overflow-x-auto snap-x -mx-4 px-4"
                style={{ scrollbarWidth: "none" }}
              >
                {recommendedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex-shrink-0 w-[140px] snap-start cursor-pointer active:scale-[0.98] transition-transform"
                    onClick={() => onProductClick(p)}
                  >
                    <div
                      className="relative aspect-square rounded-[14px] overflow-hidden"
                      style={getProductImageUrl(p) ? { backgroundColor: "#EAEAEA" } : PHOTO_PLACEHOLDER_STYLE}
                    >
                      {getProductImageUrl(p) && (
                        <Image
                          src={getProductImageUrl(p)!}
                          alt={p.name}
                          fill
                          sizes="140px"
                          className="object-contain"
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="mt-1.5 pl-0.5">
                      <h4 className="text-[13px] font-medium text-black leading-tight line-clamp-2 min-h-[32px]">
                        {p.name}
                      </h4>
                      <span className="text-[13px] text-black mt-0.5 block">
                        {parseFloat(p.base_price).toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </BottomSheet>
  );
}
