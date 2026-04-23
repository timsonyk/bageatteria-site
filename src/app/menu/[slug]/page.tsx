"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { CategoryTabs } from "@/components/CategoryTabs";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductModal } from "@/components/ProductModal";
import { LocationSelector } from "@/components/LocationSelector";
import { getCategories, getProducts, getStoreLocationBySlug } from "@/lib/api";
import { Category, Product, StoreLocation } from "@/lib/types";
import { saveSelectedLocationId } from "@/lib/location-storage";

export default function MenuSlugPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<StoreLocation | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isScrollingRef = useRef(false);

  // Загрузка точки по slug
  useEffect(() => {
    async function loadLocation() {
      try {
        const location = await getStoreLocationBySlug(slug);
        if (!location) {
          // Точка не найдена - редирект на выбор
          router.replace("/menu");
          return;
        }
        setCurrentLocation(location);
        // Сохраняем в localStorage для будущих визитов (TTL 12 часов)
        saveSelectedLocationId(location.id);
      } catch (err) {
        console.error(err);
        router.replace("/menu");
      }
    }
    loadLocation();
  }, [slug, router]);

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

  // Загрузка товаров при получении точки
  useEffect(() => {
    async function loadProducts() {
      if (!currentLocation) return;

      setLoading(true);
      try {
        const productsData = await getProducts(undefined, currentLocation.id);
        setProducts(productsData.filter((p) => p.is_active));
      } catch (err) {
        setError("Не удалось загрузить товары");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [currentLocation]);

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

  // Обработка смены точки - переход на новый URL
  const handleLocationChange = useCallback((location: StoreLocation) => {
    router.push(`/menu/${location.slug}`);
  }, [router]);

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
      <Header
        rightElement={
          <LocationSelector
            initialLocation={currentLocation}
            onLocationSelect={handleLocationChange}
          />
        }
      />

      <main className="px-4 pb-6">
        {/* Табы категорий */}
        <CategoryTabs
          categories={categories}
          activeId={activeCategory}
          onSelect={handleCategorySelect}
        />

        {loading || !currentLocation ? (
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
                  <h2 className="text-[22px] font-bold text-black mb-4">
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
        products={products}
        categories={categories}
        onProductChange={handleProductChange}
      />
    </div>
  );
}
