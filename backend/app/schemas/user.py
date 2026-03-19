from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    birthday: Optional[date] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    birthday: Optional[date] = None


class UserOut(BaseModel):
    id: int
    guest_code: Optional[int] = None
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    birthday: Optional[date] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Bageatteria: Гостевой профиль для программы лояльности
class GuestStatus(BaseModel):
    name: str  # Название статуса (Новичок, Постоянный гость, VIP)
    level: int  # Уровень (1, 2, 3)
    privileges: list[str] = []  # Привилегии


class GuestStatsOut(BaseModel):
    guest_code: int  # Уникальный числовой код
    total_spent: float  # Всего потрачено за всё время
    monthly_spent: float  # Потрачено за текущий месяц
    visits_count: int  # Количество визитов
    orders_count: int  # Количество заказов


class GuestStatusOut(BaseModel):
    status: GuestStatus
    progress_percent: float = 0  # Прогресс до следующего статуса (0-100)
    next_status_threshold: Optional[float] = None  # Порог для следующего статуса


class GuestDiscountOut(BaseModel):
    discount_percent: int  # Текущая персональная скидка %
    monthly_spent: float  # Траты за месяц
    next_discount_percent: Optional[int] = None  # Следующая скидка
    next_discount_threshold: Optional[float] = None  # Порог для следующей скидки


class GuestCodeOut(BaseModel):
    guest_code: int
    qr_content: str  # Содержимое для QR-кода


class AddressBase(BaseModel):
    label: Optional[str] = None
    address_text: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: Optional[str] = None
    entrance: Optional[str] = None
    comment: Optional[str] = None
    is_default: Optional[bool] = False


class AddressCreate(AddressBase):
    pass


class AddressUpdate(AddressBase):
    pass


class AddressOut(AddressBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class LoyaltyOut(BaseModel):
    points_available: float
    points_spent: float
    cashback_percent: float
    orders_count: int
    orders_sum: float
    first_order_date: Optional[date] = None

    class Config:
        from_attributes = True

