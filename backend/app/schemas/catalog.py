from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: int
    name: str
    unit: Optional[str] = None
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True


class ProductSizeOut(BaseModel):
    id: int
    name: str
    volume: Optional[str] = None
    volume_ml: Optional[int] = None
    base_price: float
    sort_order: int
    calories: Optional[int] = None
    proteins: Optional[float] = None
    fats: Optional[float] = None
    carbs: Optional[float] = None

    class Config:
        from_attributes = True


class ModificationOptionOut(BaseModel):
    id: int
    name: str
    extra_price: float
    image_url: Optional[str] = None
    is_default: bool
    sort_order: int
    is_active: bool
    calories: Optional[int] = None
    proteins: Optional[float] = None
    fats: Optional[float] = None
    carbs: Optional[float] = None
    calories_per_100g: Optional[int] = None
    proteins_per_100g: Optional[float] = None
    fats_per_100g: Optional[float] = None
    carbs_per_100g: Optional[float] = None
    weight: Optional[int] = None

    class Config:
        from_attributes = True


class ModificationGroupOut(BaseModel):
    id: int
    name: str
    min_count: int
    max_count: int
    type: str
    sort_order: int
    is_active: bool
    options: List[ModificationOptionOut] = []

    class Config:
        from_attributes = True


class ProductOut(BaseModel):
    id: int
    category_id: int
    name: str
    description: Optional[str] = None
    base_price: float
    size_label: Optional[str] = None
    weight: Optional[str] = None
    calories: Optional[int] = None
    proteins: Optional[float] = None
    fats: Optional[float] = None
    carbs: Optional[float] = None
    calories_per_100g: Optional[int] = None
    proteins_per_100g: Optional[float] = None
    fats_per_100g: Optional[float] = None
    carbs_per_100g: Optional[float] = None
    ingredients: Optional[str] = None
    is_active: bool
    is_recommended_menu: bool = False
    is_recommended_favorites: bool = False
    is_featured_menu: bool = False
    featured_text: Optional[str] = None
    recommended_menu_order: Optional[int] = None
    recommended_favorites_order: Optional[int] = None
    featured_menu_order: Optional[int] = None
    featured_mobile_image: Optional[str] = None
    featured_desktop_image: Optional[str] = None
    media: Optional[list] = None
    sort_order: int
    sizes: List[ProductSizeOut] = []
    modification_groups: List[ModificationGroupOut] = []

    class Config:
        from_attributes = True


class BannerOut(BaseModel):
    id: int
    title: str
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True

