// Категория товаров
export interface Category {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
}

// Размер товара
export interface ProductSize {
  id: number;
  product_id: number;
  name: string;
  volume: string;
  base_price: string;
  sort_order: number;
}

// Медиа элемент
export interface MediaItem {
  url: string;
}

// Товар
export interface Product {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  base_price: string;
  size_label: string | null;
  weight: string | null;  // "400 г" или "300 мл"
  calories: number | null;  // ккал
  proteins: number | null;  // белки, г
  fats: number | null;  // жиры, г
  carbs: number | null;  // углеводы, г
  ingredients: string | null;  // состав
  is_active: boolean;
  media: MediaItem[] | null;
  sort_order: number;
  sizes?: ProductSize[];
}

// Точка (магазин)
export interface StoreLocation {
  id: number;
  slug: string;
  name: string;
  city: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  working_hours: string | null;
  sort_order: number;
  is_active: boolean;
}

// Опция модификации
export interface ModificationOption {
  id: number;
  group_id: number;
  name: string;
  extra_price: string;
  image_url: string | null;
  is_default: boolean;
  sort_order: number;
  is_active: boolean;
}

// Группа модификаций
export interface ModificationGroup {
  id: number;
  name: string;
  min_count: number;
  max_count: number;
  type: "single" | "multiple";
  sort_order: number;
  is_active: boolean;
  options: ModificationOption[];
}

// API ответы
export interface CategoriesResponse {
  categories: Category[];
}

export interface ProductsResponse {
  products: Product[];
}
