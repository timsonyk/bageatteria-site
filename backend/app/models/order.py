import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models.catalog import DiscountType


class DeliveryType(str, enum.Enum):
    DELIVERY = "delivery"
    PICKUP = "pickup"


class OrderStatus(str, enum.Enum):
    NEW = "new"
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    IN_PROGRESS = "in_progress"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    AUTHORIZED = "authorized"
    PAID = "paid"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PaymentProvider(str, enum.Enum):
    STUB = "stub"  # TODO: Add VTB_BUSINESS when integrated


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(
        Enum(OrderStatus, values_callable=lambda obj: [e.value for e in OrderStatus], validate_strings=True),
        default=OrderStatus.NEW,
        nullable=False,
    )
    delivery_type = Column(
        Enum(DeliveryType, values_callable=lambda obj: [e.value for e in DeliveryType], validate_strings=True),
        default=DeliveryType.DELIVERY,
        nullable=False,
    )
    address_text = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    city = Column(String(50), nullable=True)
    pickup_location_id = Column(Integer, ForeignKey("pickup_locations.id"), nullable=True)
    delivery_zone_id = Column(Integer, ForeignKey("delivery_zones.id"), nullable=True)
    comment = Column(Text, nullable=True)
    no_call = Column(Boolean, default=False, nullable=False)
    promo_code_id = Column(Integer, ForeignKey("promo_codes.id"), nullable=True)
    subtotal = Column(Numeric(10, 2), nullable=False)
    delivery_fee = Column(Numeric(10, 2), nullable=False, default=0)
    discount = Column(Numeric(10, 2), nullable=False, default=0)
    total = Column(Numeric(10, 2), nullable=False)
    loyalty_earned = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete")
    payment = relationship("Payment", back_populates="order", uselist=False, cascade="all, delete")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    size_id = Column(Integer, ForeignKey("product_sizes.id"), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    base_price = Column(Numeric(10, 2), nullable=False)
    final_price = Column(Numeric(10, 2), nullable=False)
    modifications_json = Column(JSON, nullable=True)

    order = relationship("Order", back_populates="items")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True)
    provider = Column(
        Enum(PaymentProvider, values_callable=lambda obj: [e.value for e in PaymentProvider], validate_strings=True),
        default=PaymentProvider.STUB,
        nullable=False,
    )
    status = Column(
        Enum(PaymentStatus, values_callable=lambda obj: [e.value for e in PaymentStatus], validate_strings=True),
        default=PaymentStatus.PENDING,
        nullable=False,
    )
    amount = Column(Numeric(10, 2), nullable=False)
    redirect_url = Column(String(500), nullable=True)
    payment_token = Column(String(255), nullable=True)
    extra = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="payment")