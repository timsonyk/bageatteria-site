import { Category, Product } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/catalog/categories`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error("Не удалось загрузить категории");
  }

  const data = await res.json();
  return data.categories || data;
}

export async function getProducts(categoryId?: number): Promise<Product[]> {
  const url = new URL(`${API_BASE}/catalog/products`);
  if (categoryId) {
    url.searchParams.set("category_id", String(categoryId));
  }

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error("Не удалось загрузить товары");
  }

  const data = await res.json();
  return data.products || data;
}

export async function getProduct(productId: number): Promise<Product> {
  const res = await fetch(`${API_BASE}/catalog/products/${productId}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error("Не удалось загрузить товар");
  }

  return res.json();
}
