"use client";

import { useEffect, useState } from "react";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  fullHeight?: boolean;
}

export function BottomSheet({ isOpen, onClose, title, children, fullHeight = false }: BottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Wait for animation to complete before hiding
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 400);
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

  // iOS Safari theme-color: серый #7c7c7b пока шторка открыта
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Safe-area top fill — серая плашка #7c7c7b под статус-баром iOS */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          height: "env(safe-area-inset-top, 0px)",
          backgroundColor: "#7c7c7b",
          opacity: isAnimating ? 1 : 0,
          transition: "opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
          zIndex: 1,
        }}
      />
      {/* Safe-area bottom fill — белая плашка под home indicator */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "env(safe-area-inset-bottom, 0px)",
          backgroundColor: "#FFFFFF",
          opacity: isAnimating ? 1 : 0,
          transition: "opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
          zIndex: 2,
        }}
      />
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-[400ms] ${
          isAnimating ? "opacity-50" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-[20px] ${fullHeight ? "h-[90vh]" : "max-h-[80vh]"} overflow-hidden transform flex flex-col ${
          isAnimating ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ transition: "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

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
