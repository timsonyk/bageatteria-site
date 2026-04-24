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
      className="sticky z-20 bg-background py-3 -mx-2.5 md:-mx-8 px-2.5 md:px-8 overflow-x-auto [&::-webkit-scrollbar]:hidden"
      style={{ top: "env(safe-area-inset-top, 0px)", scrollbarWidth: "none" }}
    >
      <div className="relative flex gap-2 md:gap-3">
        {/* Анимированный индикатор (подчёркивание) */}
        <div
          className="absolute bottom-0 h-[2px] bg-black rounded-full transition-all duration-300 ease-out"
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
                "relative z-10 flex-shrink-0 px-4 py-2 text-base whitespace-nowrap border-0 outline-none bg-transparent transition-colors duration-200",
                isActive ? "font-medium text-black" : "font-normal text-[#8E8E93]"
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
