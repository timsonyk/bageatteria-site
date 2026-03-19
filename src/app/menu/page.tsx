"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Header } from "@/components/Header";
import { CategoryTabs } from "@/components/CategoryTabs";
import { ProductGrid } from "@/components/ProductGrid";
import { getCategories, getProducts } from "@/lib/api";
import { Category, Product } from "@/lib/types";

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const isScrollingRef = useRef(false);

  // Загрузка категорий и всех товаров
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [categoriesData, productsData] = await Promise.all([
          getCategories(),
          getProducts(),
        ]);
        setCategories(categoriesData.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order));
        setProducts(productsData.filter((p) => p.is_active));
      } catch (err) {
        setError("Не удалось загрузить меню");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

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
  }, [loading, categories]);

  // Скролл к категории при клике
  const handleCategorySelect = useCallback((categoryId: number | null) => {
    setActiveCategory(categoryId);
    if (categoryId !== null) {
      isScrollingRef.current = true;
      const element = document.getElementById(`category-${categoryId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        // Разрешаем обновление через IntersectionObserver после завершения скролла
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 800);
      }
    }
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
      <Header />

      <main className="px-4 pb-6">
        {/* Табы категорий */}
        <CategoryTabs
          categories={categories}
          activeId={activeCategory}
          onSelect={handleCategorySelect}
        />

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {categories.map((category) => {
              const categoryProducts = productsByCategory[category.id] || [];
              if (categoryProducts.length === 0) return null;

              return (
                <section key={category.id} id={`category-${category.id}`} className="scroll-mt-20">
                  {/* Заголовок категории */}
                  <h2 className="text-[22px] font-bold text-black mb-4">
                    {category.name}
                  </h2>
                  {/* Сетка товаров категории */}
                  <ProductGrid products={categoryProducts} />
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
