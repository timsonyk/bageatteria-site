"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { variantKey } from "@/lib/favorites";

export interface FavoriteEntry {
  key: string;
  productId: number;
  sizeId: number | null;
  optionIds: number[];
  qty: number;
  addedAt: number;
}

type FavoritesMap = Record<string, FavoriteEntry>;

interface FavoritesContextValue {
  entries: FavoriteEntry[];
  totalQty: number;
  getProductQty: (productId: number) => number;
  getVariantQty: (
    productId: number,
    sizeId: number | null,
    optionIds: number[]
  ) => number;
  addVariant: (
    productId: number,
    sizeId: number | null,
    optionIds: number[]
  ) => void;
  decrementVariant: (
    productId: number,
    sizeId: number | null,
    optionIds: number[]
  ) => void;
  decrementProduct: (productId: number) => void;
  removeProduct: (productId: number) => void;
  removeEntry: (key: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

const STORAGE_KEY = "bageatteria_favorites_v2";

function isValidEntry(x: unknown): x is FavoriteEntry {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.key === "string" &&
    typeof e.productId === "number" &&
    (typeof e.sizeId === "number" || e.sizeId === null) &&
    Array.isArray(e.optionIds) &&
    typeof e.qty === "number" &&
    typeof e.addedAt === "number"
  );
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<FavoritesMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const clean: FavoritesMap = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (isValidEntry(v)) clean[k] = v;
          }
          setMap(clean);
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
  }, [map, hydrated]);

  const getVariantQty = useCallback(
    (productId: number, sizeId: number | null, optionIds: number[]) => {
      const k = variantKey(productId, sizeId, optionIds);
      return map[k]?.qty ?? 0;
    },
    [map]
  );

  const getProductQty = useCallback(
    (productId: number) => {
      let sum = 0;
      for (const e of Object.values(map)) {
        if (e.productId === productId) sum += e.qty;
      }
      return sum;
    },
    [map]
  );

  const addVariant = useCallback(
    (productId: number, sizeId: number | null, optionIds: number[]) => {
      const sortedOpts = [...optionIds].sort((a, b) => a - b);
      const k = variantKey(productId, sizeId, sortedOpts);
      setMap((prev) => {
        const existing = prev[k];
        const entry: FavoriteEntry = existing
          ? { ...existing, qty: existing.qty + 1 }
          : {
              key: k,
              productId,
              sizeId,
              optionIds: sortedOpts,
              qty: 1,
              addedAt: Date.now(),
            };
        return { ...prev, [k]: entry };
      });
    },
    []
  );

  const decrementVariant = useCallback(
    (productId: number, sizeId: number | null, optionIds: number[]) => {
      const k = variantKey(productId, sizeId, optionIds);
      setMap((prev) => {
        const existing = prev[k];
        if (!existing) return prev;
        const newQty = existing.qty - 1;
        const copy = { ...prev };
        if (newQty <= 0) delete copy[k];
        else copy[k] = { ...existing, qty: newQty };
        return copy;
      });
    },
    []
  );

  const decrementProduct = useCallback((productId: number) => {
    setMap((prev) => {
      const matches = Object.values(prev).filter(
        (e) => e.productId === productId && e.qty > 0
      );
      if (matches.length === 0) return prev;
      matches.sort((a, b) => b.qty - a.qty || b.addedAt - a.addedAt);
      const target = matches[0];
      const newQty = target.qty - 1;
      const copy = { ...prev };
      if (newQty <= 0) delete copy[target.key];
      else copy[target.key] = { ...target, qty: newQty };
      return copy;
    });
  }, []);

  const removeProduct = useCallback((productId: number) => {
    setMap((prev) => {
      const copy: FavoritesMap = {};
      for (const [k, v] of Object.entries(prev)) {
        if (v.productId !== productId) copy[k] = v;
      }
      return copy;
    });
  }, []);

  const removeEntry = useCallback((key: string) => {
    setMap((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, []);

  const entries = useMemo(
    () =>
      Object.values(map).sort((a, b) => b.addedAt - a.addedAt),
    [map]
  );

  const totalQty = useMemo(
    () => Object.values(map).reduce((sum, e) => sum + e.qty, 0),
    [map]
  );

  return (
    <FavoritesContext.Provider
      value={{
        entries,
        totalQty,
        getProductQty,
        getVariantQty,
        addVariant,
        decrementVariant,
        decrementProduct,
        removeProduct,
        removeEntry,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
