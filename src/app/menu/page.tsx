"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Heart } from "lucide-react";
import { Header } from "@/components/Header";
import { CategoryTabs } from "@/components/CategoryTabs";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductModal } from "@/components/ProductModal";
import { LocationSelector } from "@/components/LocationSelector";
import { FavoritesSheet } from "@/components/FavoritesSheet";
import { RecommendedRow } from "@/components/RecommendedRow";
import { FeaturedCard } from "@/components/FeaturedCard";
import { getCategories, getProducts } from "@/lib/api";
import { Category, Product } from "@/lib/types";
import { useFavorites } from "@/contexts/FavoritesContext";

function pluralizeTovar(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "товаров";
  if (mod10 === 1) return "товар";
  if (mod10 >= 2 && mod10 <= 4) return "товара";
  return "товаров";
}

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFavoritesSheetOpen, setIsFavoritesSheetOpen] = useState(false);
  const isScrollingRef = useRef(false);
  const { totalQty } = useFavorites();

  // Загрузка категорий
  useEffect(() => {
    async function loadCategories() {
      try {
        const categoriesData = await getCategories();
        setCategories(categoriesData.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order));
      } catch (err) {
        setError("Не удалось загрузить категории");
        console.error(err);
      }
    }
    loadCategories();
  }, []);

  // Загрузка товаров при смене точки
  useEffect(() => {
    async function loadProducts() {
      if (selectedLocationId === null) return;

      setLoading(true);
      try {
        const productsData = await getProducts(undefined, selectedLocationId);
        setProducts(productsData.filter((p) => p.is_active));
      } catch (err) {
        setError("Не удалось загрузить товары");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [selectedLocationId]);

  // Рекомендации для главной
  const recommendedMenu = useMemo(
    () => products.filter((p) => p.is_active && p.is_recommended_menu),
    [products]
  );

  // Фокус дня: один активный товар
  const featuredProduct = useMemo(
    () => products.find((p) => p.is_active && p.is_featured_menu) ?? null,
    [products]
  );

  // Карта категорий (для unit у фокус-карточки)
  const categoryMap = useMemo(() => {
    const m = new Map<number, Category>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  // Группировка товаров по категориям
  const productsByCategory = useMemo(() => {
    const grouped: Record<number, Product[]> = {};
    for (const product of products) {
      if (!grouped[product.category_id]) {
        grouped[product.category_id] = [];
      }
      grouped[product.category_id].push(product);
    }
    return grouped;
  }, [products]);

  // Сортировка товаров для модалки: сначала по категории, потом по sort_order
  const sortedProducts = useMemo(() => {
    const categoryOrder = new Map(categories.map((c) => [c.id, c.sort_order]));
    return [...products].sort((a, b) => {
      const catOrderA = categoryOrder.get(a.category_id) ?? 999;
      const catOrderB = categoryOrder.get(b.category_id) ?? 999;
      if (catOrderA !== catOrderB) return catOrderA - catOrderB;
      return a.sort_order - b.sort_order;
    });
  }, [products, categories]);

  // Отслеживание скролла для автоматической смены категории
  useEffect(() => {
    if (loading || categories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;

        for (const entry of entries) {
          if (entry.isIntersecting) {
            const categoryId = parseInt(entry.target.id.replace("category-", ""));
            setActiveCategory(categoryId);
            break;
          }
        }
      },
      {
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0,
      }
    );

    categories.forEach((category) => {
      const element = document.getElementById(`category-${category.id}`);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [loading, categories, products]);

  // Скролл к категории при клике
  const handleCategorySelect = useCallback((categoryId: number | null) => {
    setActiveCategory(categoryId);
    if (categoryId !== null) {
      isScrollingRef.current = true;
      const element = document.getElementById(`category-${categoryId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 800);
      }
    }
  }, []);

  // Обработка смены точки
  const handleLocationChange = useCallback((locationId: number | null) => {
    setSelectedLocationId(locationId);
  }, []);

  // Обработка клика по товару
  const handleProductClick = useCallback((product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  }, []);

  // Закрытие модалки
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Смена товара в модалке (свайп)
  const handleProductChange = useCallback((product: Product) => {
    setSelectedProduct(product);
  }, []);

  // Heart-кнопка в модалке: закрыть модалку и открыть лист избранного
  const handleOpenFavorites = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => setIsFavoritesSheetOpen(true), 300);
  }, []);

  // Клик по товару из листа избранного: закрыть лист, открыть модалку
  const handleFavoritesProductClick = useCallback((product: Product) => {
    setIsFavoritesSheetOpen(false);
    setTimeout(() => {
      setSelectedProduct(product);
      setIsModalOpen(true);
    }, 300);
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header rightElement={<LocationSelector onLocationChange={handleLocationChange} />} />

      <main className={`px-2.5 ${totalQty > 0 ? "pb-28" : "pb-6"}`}>
        {/* Фокус дня и рекомендации — над каталогом */}
        {!loading && selectedLocationId !== null && (
          <>
            {featuredProduct && (
              <FeaturedCard
                product={featuredProduct}
                categoryUnit={categoryMap.get(featuredProduct.category_id)?.unit}
                onClick={() => handleProductClick(featuredProduct)}
              />
            )}
            <RecommendedRow
              products={recommendedMenu}
              onProductClick={handleProductClick}
            />
          </>
        )}

        {/* Табы категорий */}
        <CategoryTabs
          categories={categories}
          activeId={activeCategory}
          onSelect={handleCategorySelect}
        />

        {loading || selectedLocationId === null ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500">Нет доступных товаров на этой точке</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {categories.map((category) => {
              const categoryProducts = productsByCategory[category.id] || [];
              if (categoryProducts.length === 0) return null;

              return (
                <section key={category.id} id={`category-${category.id}`} className="scroll-mt-20">
                  <h2 className="text-[28px] font-normal text-black tracking-[-0.6px] leading-none mb-4">
                    {category.name}
                  </h2>
                  <ProductGrid products={categoryProducts} categoryUnit={category.unit} onProductClick={handleProductClick} />
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Product Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        product={selectedProduct}
        products={sortedProducts}
        categories={categories}
        onProductChange={handleProductChange}
        onOpenFavorites={handleOpenFavorites}
      />

      {/* Favorites Sheet */}
      <FavoritesSheet
        isOpen={isFavoritesSheetOpen}
        onClose={() => setIsFavoritesSheetOpen(false)}
        products={sortedProducts}
        categories={categories}
        onProductClick={handleFavoritesProductClick}
        recommendedProducts={products.filter((p) => p.is_active && p.is_recommended_favorites)}
      />

      {/* Sticky bottom bar — полностью прозрачная обёртка (включая safe-area),
          пилюля плавает, контент виден насквозь. */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pt-8 z-30"
        style={{
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
          background:
            "linear-gradient(to top, var(--background) 45%, color-mix(in srgb, var(--background) 80%, transparent) 70%, transparent 100%)",
          opacity: totalQty > 0 ? 1 : 0,
          pointerEvents: totalQty > 0 ? "auto" : "none",
          transition: "opacity 250ms ease-out",
        }}
      >
        <button
          type="button"
          onClick={() => setIsFavoritesSheetOpen(true)}
          className="w-full h-14 rounded-full bg-[#E5E5EA] flex items-center justify-between px-5 active:scale-[0.98] transition-transform"
        >
          <span className="text-[17px] font-semibold text-black">
            Избранное · {totalQty} {pluralizeTovar(totalQty)}
          </span>
          <Heart className="w-6 h-6 text-black" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
