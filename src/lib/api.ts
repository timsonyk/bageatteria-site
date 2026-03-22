import { Category, Product, StoreLocation } from "./types";

// Use proxy in browser, direct URL on server
const API_BASE = typeof window !== "undefined"
  ? "/api/proxy"
  : (process.env.BACKEND_URL || "http://localhost:8000");

export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/catalog/categories`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Не удалось загрузить категории");
  }

  const data = await res.json();
  return data.categories || data;
}

export async function getProducts(categoryId?: number, storeLocationId?: number): Promise<Product[]> {
  const params = new URLSearchParams();
  if (categoryId) {
    params.set("category_id", String(categoryId));
  }
  if (storeLocationId) {
    params.set("store_location_id", String(storeLocationId));
  }
  const query = params.toString();
  const url = `${API_BASE}/catalog/products${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Не удалось загрузить товары");
  }

  const data = await res.json();
  return data.products || data;
}

export async function getStoreLocations(): Promise<StoreLocation[]> {
  const res = await fetch(`${API_BASE}/catalog/store_locations`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Не удалось загрузить точки");
  }

  return res.json();
}

export async function getProduct(productId: number): Promise<Product> {
  const res = await fetch(`${API_BASE}/catalog/products/${productId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Не удалось загрузить товар");
  }

  return res.json();
}
