import enum
from datetime import datetime
from typing import Optional

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
from sqlalchemy.orm import relationship, backref

from app.db.session import Base


class ModificationType(str, enum.Enum):
    SINGLE = "single"
    MULTIPLE = "multiple"


class DiscountType(str, enum.Enum):
    FIXED = "fixed"
    PERCENT = "percent"


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    base_price = Column(Numeric(10, 2), nullable=False)
    size_label = Column(String(10), nullable=True)  # fallback when no sizes table
    weight = Column(String(50), nullable=True)  # "400 г" или "300 мл"
    calories = Column(Integer, nullable=True)  # ккал
    is_active = Column(Boolean, default=True, nullable=False)
    media = Column(JSON, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)

    category = relationship("Category", back_populates="products")
    sizes = relationship("ProductSize", back_populates="product", cascade="all, delete")
    modification_groups = relationship("ModificationGroup", secondary="modification_group_products", back_populates="products")


class ProductSize(Base):
    __tablename__ = "product_sizes"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    name = Column(String(50), nullable=False)  # S, M, L
    volume = Column(String(50), nullable=True)  # 200 мл, 300 мл, 400 мл
    base_price = Column(Numeric(10, 2), nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)

    product = relationship("Product", back_populates="sizes")


class ModificationGroup(Base):
    __tablename__ = "modification_groups"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    min_count = Column(Integer, default=0, nullable=False)
    max_count = Column(Integer, default=1, nullable=False)
    type = Column(
        Enum(
            ModificationType,
            values_callable=lambda obj: [e.value for e in ModificationType],
            validate_strings=True,
        ),
        default=ModificationType.SINGLE,
        nullable=False,
    )
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    products = relationship("Product", secondary="modification_group_products", back_populates="modification_groups")
    options = relationship("ModificationOption", back_populates="group", cascade="all, delete")


class ModificationOption(Base):
    __tablename__ = "modification_options"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("modification_groups.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    extra_price = Column(Numeric(10, 2), default=0, nullable=False)
    image_url = Column(String(500), nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    group = relationship("ModificationGroup", back_populates="options")


class ModificationGroupProduct(Base):
    __tablename__ = "modification_group_products"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("modification_groups.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)


class Banner(Base):
    __tablename__ = "banners"

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    subtitle = Column(String(255), nullable=True)
    image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    discount_type = Column(
        Enum(
            DiscountType,
            values_callable=lambda obj: [e.value for e in DiscountType],
            validate_strings=True,
        ),
        nullable=False,
    )
    discount_value = Column(Numeric(10, 2), nullable=False)
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    min_order_total = Column(Numeric(10, 2), nullable=True)
    allowed_category_ids = Column(JSON, nullable=True)
    usage_limit = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


class PickupLocation(Base):
    __tablename__ = "pickup_locations"

    id = Column(Integer, primary_key=True)
    city = Column(String(50), nullable=False)
    address = Column(String(255), nullable=False)
    schedule_text = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)


class FAQ(Base):
    __tablename__ = "faqs"

    id = Column(Integer, primary_key=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


class AppText(Base):
    __tablename__ = "app_texts"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)


class DeliveryZone(Base):
    __tablename__ = "delivery_zones"

    id = Column(Integer, primary_key=True)
    city = Column(String(50), nullable=False)
    polygon = Column(JSON, nullable=True)
    delivery_fee = Column(Numeric(10, 2), nullable=False)
    sla_minutes = Column(Integer, default=180, nullable=False)
    min_order_total = Column(Numeric(10, 2), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class StoreLocation(Base):
    """Store locations for display in app (addresses, contacts, etc.)"""
    __tablename__ = "store_locations"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, default="")  # Название точки (Депо, Смоленская)
    city = Column(String(100), nullable=False)
    address_text = Column(Text, nullable=False)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    phone = Column(String(20), nullable=True)
    working_hours = Column(String(255), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)


class CategoryRecommendation(Base):
    """Recommendations settings per category - which products to show"""
    __tablename__ = "category_recommendations"

    id = Column(Integer, primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    sort_order = Column(Integer, default=0, nullable=False)

    category = relationship("Category", backref=backref("recommendations", cascade="all, delete-orphan"))
    product = relationship("Product")
