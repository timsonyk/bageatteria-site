// Категория товаров
export interface Category {
  id: number;
  name: string;
  unit?: string;  // г, кг, мл
  sort_order: number;
  is_active: boolean;
}

// Размер товара
export interface ProductSize {
  id: number;
  product_id: number;
  name: string;
  volume: string;
  volume_ml?: number | null;
  base_price: string;
  sort_order: number;
  calories?: number | null;
  proteins?: number | null;
  fats?: number | null;
  carbs?: number | null;
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
  calories: number | null;  // ккал (per portion legacy)
  proteins: number | null;
  fats: number | null;
  carbs: number | null;
  calories_per_100g?: number | null;
  proteins_per_100g?: number | null;
  fats_per_100g?: number | null;
  carbs_per_100g?: number | null;
  ingredients: string | null;  // состав
  is_active: boolean;
  is_recommended_menu?: boolean;
  is_recommended_favorites?: boolean;
  is_featured_menu?: boolean;
  featured_text?: string | null;
  recommended_menu_order?: number | null;
  recommended_favorites_order?: number | null;
  featured_menu_order?: number | null;
  featured_mobile_image?: string | null;
  featured_desktop_image?: string | null;
  media: MediaItem[] | null;
  sort_order: number;
  sizes?: ProductSize[];
  modification_groups?: ModificationGroup[];
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
  // Абсолютная дельта (legacy)
  calories?: number | null;
  proteins?: number | null;
  fats?: number | null;
  carbs?: number | null;
  // КБЖУ на 100 г — полная замена базы
  calories_per_100g?: number | null;
  proteins_per_100g?: number | null;
  fats_per_100g?: number | null;
  carbs_per_100g?: number | null;
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
