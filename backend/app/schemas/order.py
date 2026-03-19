from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.catalog import ProductOut
from app.schemas.user import AddressOut


class OrderItemCreate(BaseModel):
    product_id: int
    size_id: Optional[int] = None
    quantity: int = Field(1, ge=1)
    modification_option_ids: List[int] = []


class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    delivery_type: str = "delivery"
    address_text: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: Optional[str] = None
    pickup_location_id: Optional[int] = None
    comment: Optional[str] = None
    no_call: bool = False
    promo_code: Optional[str] = None


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    size_id: Optional[int] = None
    quantity: int
    base_price: float
    final_price: float
    modifications_json: Optional[dict] = None

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    status: str
    delivery_type: str
    address_text: Optional[str] = None
    city: Optional[str] = None
    pickup_location_id: Optional[int] = None
    delivery_fee: float
    subtotal: float
    discount: float
    total: float
    loyalty_earned: float
    no_call: bool
    comment: Optional[str] = None
    created_at: datetime
    items: List[OrderItemOut] = []

    class Config:
        from_attributes = True


class PriceRequest(BaseModel):
    items: List[OrderItemCreate]
    promo_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: Optional[str] = None
    delivery_type: str = "delivery"


class PriceResponse(BaseModel):
    subtotal: float
    discount: float
    delivery_fee: float
    total: float
    loyalty_earned: float


class PaymentInitResponse(BaseModel):
    payment_id: int
    status: str
    redirect_url: Optional[str] = None
    token: Optional[str] = None

