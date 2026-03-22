from datetime import datetime
from typing import Optional, List, Any

from pydantic import BaseModel


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class CategoryCreate(BaseModel):
    name: str
    sort_order: int = 0
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ProductCreate(BaseModel):
    name: str
    category_id: int
    description: Optional[str] = None
    base_price: float
    size_label: Optional[str] = None
    weight: Optional[str] = None  # "400 г" или "300 мл"
    calories: Optional[int] = None  # ккал
    proteins: Optional[float] = None  # белки, г
    fats: Optional[float] = None  # жиры, г
    carbs: Optional[float] = None  # углеводы, г
    ingredients: Optional[str] = None  # состав
    sort_order: int = 0
    is_active: bool = True
    media: Optional[list] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[int] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    size_label: Optional[str] = None
    weight: Optional[str] = None
    calories: Optional[int] = None
    proteins: Optional[float] = None
    fats: Optional[float] = None
    carbs: Optional[float] = None
    ingredients: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    media: Optional[list] = None


class BulkPriceUpdateRequest(BaseModel):
    """
    Массовое изменение цен.

    percent: signed percent (e.g. +10.0 or -15.0)
    """

    product_ids: Optional[List[int]] = None
    apply_to_all: bool = False
    percent: float
    apply_to_sizes: bool = False


class ProductSizeCreate(BaseModel):
    product_id: int
    name: str
    volume: Optional[str] = None
    base_price: float
    sort_order: int = 0


class ProductSizeUpdate(BaseModel):
    name: Optional[str] = None
    volume: Optional[str] = None
    base_price: Optional[float] = None
    sort_order: Optional[int] = None


class ModificationGroupCreate(BaseModel):
    product_ids: Optional[List[int]] = None
    name: str
    min_count: int = 0
    max_count: int = 1
    type: str = "single"
    sort_order: int = 0
    is_active: bool = True


class ModificationGroupUpdate(BaseModel):
    product_ids: Optional[List[int]] = None
    name: Optional[str] = None
    min_count: Optional[int] = None
    max_count: Optional[int] = None
    type: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ModificationOptionCreate(BaseModel):
    group_id: int
    name: str
    extra_price: float = 0
    image_url: Optional[str] = None
    is_default: bool = False
    sort_order: int = 0
    is_active: bool = True


class ModificationOptionUpdate(BaseModel):
    name: Optional[str] = None
    extra_price: Optional[float] = None
    image_url: Optional[str] = None
    is_default: Optional[bool] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class BannerCreate(BaseModel):
    title: str
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class BannerUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str
    discount_value: float
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    min_order_total: Optional[float] = None
    allowed_category_ids: Optional[list[int]] = None
    usage_limit: Optional[int] = None
    is_active: bool = True


class PromoCodeUpdate(BaseModel):
    code: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    min_order_total: Optional[float] = None
    allowed_category_ids: Optional[list[int]] = None
    usage_limit: Optional[int] = None
    is_active: Optional[bool] = None


class PickupLocationCreate(BaseModel):
    city: str
    address: str
    schedule_text: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class PickupLocationUpdate(BaseModel):
    city: Optional[str] = None
    address: Optional[str] = None
    schedule_text: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class DeliveryZoneCreate(BaseModel):
    city: str
    polygon: List[Any]
    delivery_fee: float
    sla_minutes: int = 180
    min_order_total: Optional[float] = None
    is_active: bool = True
    sort_order: int = 0


class DeliveryZoneUpdate(BaseModel):
    city: Optional[str] = None
    polygon: Optional[List[Any]] = None
    delivery_fee: Optional[float] = None
    sla_minutes: Optional[int] = None
    min_order_total: Optional[float] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class FAQCreate(BaseModel):
    question: str
    answer: str
    sort_order: int = 0
    is_active: bool = True


class FAQUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class AppTextUpdate(BaseModel):
    key: str
    value: str


class LoyaltySettingsUpdate(BaseModel):
    cashback_percent: float


class CustomerOut(BaseModel):
    id: int
    phone: str
    name: Optional[str] = None
    telegram_id: Optional[int] = None
    legacy_client_id: Optional[str] = None
    first_order_date: Optional[datetime] = None
    orders_count: int
    orders_sum: float
    points_available: float
    points_spent: float
    created_at: datetime
    
    class Config:
        from_attributes = True


class CustomerListResponse(BaseModel):
    items: List[CustomerOut]
    total: int


class PointsAdjustmentRequest(BaseModel):
    amount: float
    type: str  # "add", "subtract", "set"
    reason: Optional[str] = None


class StoreLocationCreate(BaseModel):
    slug: str  # URL slug: "depo", "smolenskaya"
    name: Optional[str] = None  # Название точки - если не указано, берётся из адреса
    city: str
    address_text: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    working_hours: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class StoreLocationUpdate(BaseModel):
    slug: Optional[str] = None
    name: Optional[str] = None
    city: Optional[str] = None
    address_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    phone: Optional[str] = None
    working_hours: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryRecommendationCreate(BaseModel):
    category_id: int
    product_id: int
    sort_order: int = 0


class CategoryRecommendationUpdate(BaseModel):
    sort_order: Optional[int] = None


class CategoryRecommendationsBulkUpdate(BaseModel):
    """Update all recommendations for a category at once"""
    category_id: int
    product_ids: List[int]  # List of product IDs in order


class ProductAvailabilityCreate(BaseModel):
    product_id: int
    store_location_id: int


class ProductAvailabilityBulkUpdate(BaseModel):
    """Update all store availability for a product at once"""
    product_id: int
    store_location_ids: List[int]  # List of store location IDs where product is available


