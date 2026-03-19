"""
Pydantic schemas for stock management.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator


# ============ Validators ============

def validate_non_negative(value: Optional[float], field_name: str = "quantity") -> Optional[float]:
    """Validate that a value is not negative."""
    if value is not None and value < 0:
        raise ValueError(f"{field_name} cannot be negative")
    return value


# ============ Stock Categories ============

class StockCategoryBase(BaseModel):
    name: str
    unit: str = "pieces"  # pieces, grams, kilos, liters, ml
    tolerance: float = 0
    tolerance_is_percent: bool = False
    sort_order: int = 0
    is_active: bool = True


class StockCategoryCreate(StockCategoryBase):
    pass


class StockCategoryUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    tolerance: Optional[float] = None
    tolerance_is_percent: Optional[bool] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class StockCategoryOut(StockCategoryBase):
    id: int

    class Config:
        from_attributes = True


# ============ Stock Items ============

class StockItemBase(BaseModel):
    name: str
    stock_category_id: int
    product_id: Optional[int] = None
    iiko_sku: Optional[str] = None
    unit: Optional[str] = None  # Override category unit
    tolerance: Optional[float] = None  # Override category tolerance
    sort_order: int = 0
    is_active: bool = True


class StockItemCreate(StockItemBase):
    pass


class StockItemUpdate(BaseModel):
    name: Optional[str] = None
    stock_category_id: Optional[int] = None
    product_id: Optional[int] = None
    iiko_sku: Optional[str] = None
    unit: Optional[str] = None
    tolerance: Optional[float] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class StockItemOut(StockItemBase):
    id: int
    stock_category: Optional[StockCategoryOut] = None

    class Config:
        from_attributes = True


# ============ Current Stock ============

class CurrentStockOut(BaseModel):
    id: int
    stock_item_id: int
    store_location_id: int
    quantity: float
    last_updated: datetime
    stock_item: Optional[StockItemOut] = None

    class Config:
        from_attributes = True


class CurrentStockByLocation(BaseModel):
    store_location_id: int
    store_location_name: str
    items: List[CurrentStockOut]


# ============ Deliveries ============

class DeliveryLineBase(BaseModel):
    stock_item_id: int
    expected_quantity: float
    actual_quantity: Optional[float] = None
    discrepancy_reason: Optional[str] = None  # недовоз, брак, пересорт, излишек
    discrepancy_notes: Optional[str] = None

    @field_validator('expected_quantity', 'actual_quantity')
    @classmethod
    def validate_quantity(cls, v: Optional[float]) -> Optional[float]:
        return validate_non_negative(v)


class DeliveryLineCreate(DeliveryLineBase):
    pass


class DeliveryLineUpdate(BaseModel):
    actual_quantity: Optional[float] = None
    discrepancy_reason: Optional[str] = None
    discrepancy_notes: Optional[str] = None

    @field_validator('actual_quantity')
    @classmethod
    def validate_quantity(cls, v: Optional[float]) -> Optional[float]:
        return validate_non_negative(v)


class DeliveryLineOut(DeliveryLineBase):
    id: int
    delivery_id: int
    stock_item: Optional[StockItemOut] = None

    class Config:
        from_attributes = True


class DeliveryPhotoOut(BaseModel):
    id: int
    delivery_id: int
    photo_url: str
    thumbnail_url: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class DeliveryBase(BaseModel):
    store_location_id: int
    delivery_number: Optional[str] = None
    supplier_name: Optional[str] = None
    expected_date: Optional[datetime] = None
    notes: Optional[str] = None


class DeliveryCreate(DeliveryBase):
    lines: List[DeliveryLineCreate] = []


class DeliveryUpdate(BaseModel):
    delivery_number: Optional[str] = None
    supplier_name: Optional[str] = None
    expected_date: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class DeliveryOut(DeliveryBase):
    id: int
    status: str
    actual_date: Optional[datetime] = None
    received_by_telegram_id: Optional[int] = None
    received_by_name: Optional[str] = None
    iiko_document_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    lines: List[DeliveryLineOut] = []
    photos: List[DeliveryPhotoOut] = []

    class Config:
        from_attributes = True


class DeliveryListOut(BaseModel):
    id: int
    store_location_id: int
    store_location_name: Optional[str] = None
    delivery_number: Optional[str] = None
    supplier_name: Optional[str] = None
    expected_date: Optional[datetime] = None
    actual_date: Optional[datetime] = None
    status: str
    received_by_name: Optional[str] = None
    lines_count: int = 0
    photos_count: int = 0
    has_discrepancies: bool = False
    created_at: datetime


# ============ Inventories ============

class InventoryLineBase(BaseModel):
    stock_item_id: int
    expected_quantity: float
    actual_quantity: Optional[float] = None
    notes: Optional[str] = None

    @field_validator('expected_quantity', 'actual_quantity')
    @classmethod
    def validate_quantity(cls, v: Optional[float]) -> Optional[float]:
        return validate_non_negative(v)


class InventoryLineCreate(InventoryLineBase):
    pass


class InventoryLineUpdate(BaseModel):
    actual_quantity: Optional[float] = None
    notes: Optional[str] = None

    @field_validator('actual_quantity')
    @classmethod
    def validate_quantity(cls, v: Optional[float]) -> Optional[float]:
        return validate_non_negative(v)


class InventoryLineOut(BaseModel):
    id: int
    inventory_id: int
    stock_item_id: int
    expected_quantity: float
    actual_quantity: Optional[float] = None
    discrepancy: Optional[float] = None
    tolerance: float
    within_tolerance: Optional[bool] = None
    notes: Optional[str] = None
    stock_item: Optional[StockItemOut] = None

    class Config:
        from_attributes = True


class InventoryBase(BaseModel):
    store_location_id: int
    date: datetime
    notes: Optional[str] = None


class InventoryCreate(InventoryBase):
    lines: List[InventoryLineCreate] = []


class InventoryUpdate(BaseModel):
    notes: Optional[str] = None
    review_notes: Optional[str] = None


class InventoryOut(InventoryBase):
    id: int
    status: str
    conducted_by_telegram_id: Optional[int] = None
    conducted_by_name: Optional[str] = None
    reviewed_by_admin_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    has_discrepancies: bool
    discrepancies_within_tolerance: bool
    created_at: datetime
    updated_at: datetime
    lines: List[InventoryLineOut] = []

    class Config:
        from_attributes = True


class InventoryListOut(BaseModel):
    id: int
    store_location_id: int
    store_location_name: Optional[str] = None
    date: datetime
    status: str
    conducted_by_name: Optional[str] = None
    has_discrepancies: bool
    discrepancies_within_tolerance: bool
    lines_count: int = 0
    created_at: datetime


# ============ Stock Movements ============

class StockMovementOut(BaseModel):
    id: int
    stock_item_id: int
    store_location_id: int
    movement_type: str  # delivery, sale, write_off, inventory_adjustment
    quantity: float
    quantity_before: float
    quantity_after: float
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    notes: Optional[str] = None
    performed_by: Optional[str] = None
    iiko_transaction_id: Optional[str] = None
    created_at: datetime
    stock_item: Optional[StockItemOut] = None

    class Config:
        from_attributes = True


# ============ Telegram Bot Requests ============

class TelegramDeliveryReceiveRequest(BaseModel):
    """Request from Telegram bot to receive a delivery."""
    delivery_id: int
    telegram_id: int
    telegram_name: str
    lines: List[DeliveryLineUpdate]


class TelegramInventorySubmitRequest(BaseModel):
    """Request from Telegram bot to submit inventory."""
    store_location_id: int
    telegram_id: int
    telegram_name: str
    lines: List[InventoryLineCreate]
    notes: Optional[str] = None


# ============ Dashboard ============

class StockDashboardLocation(BaseModel):
    store_location_id: int
    store_location_name: str
    pending_deliveries: int
    deliveries_with_discrepancies: int
    today_inventory_status: Optional[str] = None  # ok, discrepancy, pending, none
    low_stock_items: int = 0


class StockDashboard(BaseModel):
    locations: List[StockDashboardLocation]
    total_pending_deliveries: int
    total_inventories_pending_review: int
