"use client";

import { useEffect, useRef, useState } from "react";
import { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategoryTabsProps {
  categories: Category[];
  activeId: number | null;
  onSelect: (id: number | null) => void;
}

export function CategoryTabs({ categories, activeId, onSelect }: CategoryTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  // Обновление позиции индикатора
  useEffect(() => {
    if (activeId === null) {
      setIndicatorStyle({ left: 0, width: 0 });
      return;
    }

    const button = buttonsRef.current.get(activeId);
    if (button) {
      setIndicatorStyle({
        left: button.offsetLeft,
        width: button.offsetWidth,
      });
    }
  }, [activeId, categories]);

  // Автоскролл к активной категории в табах
  useEffect(() => {
    if (activeId === null || !containerRef.current) return;

    const button = buttonsRef.current.get(activeId);
    if (button && containerRef.current) {
      const container = containerRef.current;
      const scrollLeft = button.offsetLeft - container.offsetWidth / 2 + button.offsetWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [activeId]);

  return (
    <div
      ref={containerRef}
      className="sticky top-0 z-20 bg-background py-3 -mx-4 px-4 overflow-x-auto scrollbar-hide"
    >
      <div className="relative flex gap-2">
        {/* Анимированный индикатор */}
        <div
          className="absolute top-0 h-full bg-[#F2F2F7] rounded-full transition-all duration-300 ease-out"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            opacity: activeId !== null ? 1 : 0,
          }}
        />

        {/* Категории */}
        {categories.map((category) => {
          const isActive = activeId === category.id;
          return (
            <button
              key={category.id}
              ref={(el) => {
                if (el) buttonsRef.current.set(category.id, el);
              }}
              onClick={() => onSelect(category.id)}
              className={cn(
                "relative z-10 flex-shrink-0 px-4 py-2 rounded-full text-base whitespace-nowrap border-0 outline-none bg-transparent text-black",
                isActive ? "font-medium" : "font-normal"
              )}
            >
              {category.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
