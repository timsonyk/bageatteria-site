"use client";

import { useEffect, useRef, useState } from "react";

interface ExpandableTextProps {
  text: string;
  className?: string;
  lines?: number; // сколько строк показывать до раскрытия (default 2)
  moreLabel?: string;
  lessLabel?: string;
}

export function ExpandableText({
  text,
  className = "",
  lines = 2,
  moreLabel = "Читать далее",
  lessLabel = "Свернуть",
}: ExpandableTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Сравниваем scroll/client height: отличие = есть обрезка
    const check = () => {
      if (!ref.current) return;
      setOverflows(ref.current.scrollHeight > ref.current.clientHeight + 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, lines]);

  return (
    <>
      <p
        ref={ref}
        className={`whitespace-pre-line break-words ${className}`}
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
        }
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="text-[13px] text-[#1A1410] font-medium underline underline-offset-2 decoration-[#8E8E93] decoration-1 mt-1 active:opacity-60"
        >
          {expanded ? lessLabel : moreLabel}
        </button>
      )}
    </>
  );
}
