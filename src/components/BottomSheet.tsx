"use client";

import { useEffect, useRef, useState } from "react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  fullHeight?: boolean;
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export function BottomSheet({ isOpen, onClose, title, children, fullHeight = false }: BottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const isDesktop = useIsDesktop();

  // Свайп-вниз для закрытия (только mobile).
  const [verticalOffset, setVerticalOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef<{ y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDesktop) return;
    touchStartRef.current = { y: e.touches[0].clientY };
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDesktop || !touchStartRef.current) return;
    const diffY = e.touches[0].clientY - touchStartRef.current.y;
    if (diffY > 0) setVerticalOffset(diffY);
  };

  const handleTouchEnd = () => {
    if (isDesktop || !touchStartRef.current) return;
    const offset = verticalOffset;
    touchStartRef.current = null;
    setIsDragging(false);
    if (offset > 100) {
      onClose();
    }
    setVerticalOffset(0);
  };

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setVerticalOffset(0);
      setIsDragging(false);
      touchStartRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(false);
      const raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      return () => cancelAnimationFrame(raf1);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // iOS Safari theme-color: серый #7c7c7b пока шторка открыта (только mobile)
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

  if (!isVisible) return null;

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
          opacity: isAnimating ? Math.max(0, 0.5 - verticalOffset / 600) : 0,
          transition: isDragging ? "none" : "opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={
          isDesktop
            ? `relative bg-white rounded-[20px] w-[560px] max-w-[calc(100vw-32px)] ${fullHeight ? "h-[85vh]" : "max-h-[85vh]"} overflow-hidden flex flex-col`
            : `absolute left-0 right-0 bottom-0 bg-white rounded-t-[20px] ${fullHeight ? "" : "max-h-[80vh]"} overflow-hidden flex flex-col`
        }
        style={
          isDesktop
            ? {
                transform: isAnimating ? "none" : "scale(0.96)",
                opacity: isAnimating ? 1 : 0,
                transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
              }
            : {
                top: fullHeight ? "max(44px, env(safe-area-inset-top, 44px))" : undefined,
                transform: isAnimating
                  ? `translateY(${verticalOffset}px)`
                  : "translateY(100%)",
                transition: isDragging
                  ? "none"
                  : "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
              }
        }
      >
        {/* Handle (только mobile) — свайп вниз для закрытия */}
        {!isDesktop && (
          <div
            className="flex justify-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
        )}

        {/* Title */}
        {title && (
          <div className="px-4 pb-3 border-b border-gray-100 flex-shrink-0">
            <h2 className="text-lg font-semibold text-center">{title}</h2>
          </div>
        )}

        {/* Content */}
        {fullHeight ? (
          <div className="flex-1 min-h-0 flex flex-col">{children}</div>
        ) : (
          <div className="overflow-y-auto flex-1 min-h-0">{children}</div>
        )}
      </div>
    </div>
  );
}
