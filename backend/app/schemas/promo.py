from typing import Optional

from pydantic import BaseModel

from app.schemas.order import OrderItemCreate


class PromoValidateRequest(BaseModel):
    code: str
    items: list[OrderItemCreate]
    city: Optional[str] = None


class PromoValidateResponse(BaseModel):
    valid: bool
    discount: float = 0
    reason: Optional[str] = None

