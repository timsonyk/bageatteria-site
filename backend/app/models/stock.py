"""
Stock management models for Bageatteria.

This module handles:
- Deliveries (Приёмка) - incoming goods with photos
- Inventory (Инвентаризация) - stock counting sessions
- Stock tracking per store location
"""

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
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.session import Base


class StockUnit(str, enum.Enum):
    """Units for stock tracking."""
    PIECES = "pieces"  # Штуки (кондитерка, хлеб)
    GRAMS = "grams"    # Граммы (кофе)
    KILOS = "kilos"    # Килограммы
    LITERS = "liters"  # Литры (молоко)
    ML = "ml"          # Миллилитры


class DeliveryStatus(str, enum.Enum):
    """Status of a delivery/receipt."""
    PENDING = "pending"        # Ожидает приёмки
    IN_PROGRESS = "in_progress"  # Бариста начал приёмку
    COMPLETED = "completed"    # Приёмка завершена
    HAS_DISCREPANCY = "has_discrepancy"  # Есть расхождения


class InventoryStatus(str, enum.Enum):
    """Status of inventory session."""
    DRAFT = "draft"              # Черновик (бариста заполняет)
    SUBMITTED = "submitted"      # Отправлена на проверку
    OK = "ok"                    # Всё в норме (авто или ручное)
    DISCREPANCY = "discrepancy"  # Есть расхождения, требует проверки
    ACCEPTED = "accepted"        # Принята руководителем
    REJECTED = "rejected"        # Отклонена


class StockCategory(Base):
    """
    Categories for stock tracking with their settings.
    Separate from product categories - this defines how items are counted.
    """
    __tablename__ = "stock_categories"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)  # Кондитерка, Хлебобулочные, Кофе
    unit = Column(
        Enum(StockUnit, values_callable=lambda obj: [e.value for e in StockUnit]),
        default=StockUnit.PIECES,
        nullable=False,
    )
    tolerance = Column(Float, default=0, nullable=False)  # Допустимое расхождение (0 = точное совпадение)
    tolerance_is_percent = Column(Boolean, default=False, nullable=False)  # tolerance в процентах или абсолютное
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    items = relationship("StockItem", back_populates="stock_category")


class StockItem(Base):
    """
    Items that are tracked for stock.
    Links to Product but has additional stock-specific settings.
    """
    __tablename__ = "stock_items"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)  # Связь с товаром (опционально)
    stock_category_id = Column(Integer, ForeignKey("stock_categories.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)  # Название для учёта (может отличаться от товара)
    iiko_sku = Column(String(100), nullable=True, index=True)  # SKU в iiko
    unit = Column(
        Enum(StockUnit, values_callable=lambda obj: [e.value for e in StockUnit]),
        nullable=True,  # Если null, берём из stock_category
    )
    tolerance = Column(Float, nullable=True)  # Переопределение допуска (если null, берём из категории)
    is_active = Column(Boolean, default=True, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)

    stock_category = relationship("StockCategory", back_populates="items")
    product = relationship("Product")


class CurrentStock(Base):
    """
    Current stock levels per item per store location.
    Updated by deliveries, sales, and inventory sessions.
    """
    __tablename__ = "current_stocks"

    id = Column(Integer, primary_key=True)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False, index=True)
    store_location_id = Column(Integer, ForeignKey("store_locations.id"), nullable=False, index=True)
    quantity = Column(Float, default=0, nullable=False)  # Текущий остаток
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    stock_item = relationship("StockItem")
    store_location = relationship("StoreLocation")

    __table_args__ = (
        # Unique constraint: one stock record per item per location
        {"sqlite_autoincrement": True},
    )


class Delivery(Base):
    """
    Incoming delivery/receipt (Приёмка).
    Created by manager or synced from iiko, completed by barista.
    """
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True)
    store_location_id = Column(Integer, ForeignKey("store_locations.id"), nullable=False, index=True)
    delivery_number = Column(String(50), nullable=True, index=True)  # Номер накладной
    supplier_name = Column(String(255), nullable=True)  # Поставщик
    expected_date = Column(DateTime, nullable=True)  # Ожидаемая дата
    actual_date = Column(DateTime, nullable=True)  # Фактическая дата приёмки
    status = Column(
        Enum(DeliveryStatus, values_callable=lambda obj: [e.value for e in DeliveryStatus]),
        default=DeliveryStatus.PENDING,
        nullable=False,
        index=True,
    )
    received_by_telegram_id = Column(Integer, nullable=True)  # Telegram ID бариста
    received_by_name = Column(String(255), nullable=True)  # Имя бариста
    notes = Column(Text, nullable=True)  # Комментарии
    iiko_document_id = Column(String(100), nullable=True, index=True)  # ID документа в iiko
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    store_location = relationship("StoreLocation")
    lines = relationship("DeliveryLine", back_populates="delivery", cascade="all, delete-orphan")
    photos = relationship("DeliveryPhoto", back_populates="delivery", cascade="all, delete-orphan")


class DeliveryLine(Base):
    """
    Individual item in a delivery.
    Tracks expected vs actual quantity and discrepancy reason.
    """
    __tablename__ = "delivery_lines"

    id = Column(Integer, primary_key=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"), nullable=False, index=True)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False, index=True)
    expected_quantity = Column(Float, nullable=False)  # Ожидаемое количество по накладной
    actual_quantity = Column(Float, nullable=True)  # Фактическое количество (заполняет бариста)
    discrepancy_reason = Column(String(50), nullable=True)  # недовоз, брак, пересорт, излишек
    discrepancy_notes = Column(Text, nullable=True)  # Комментарий к расхождению

    delivery = relationship("Delivery", back_populates="lines")
    stock_item = relationship("StockItem")


class DeliveryPhoto(Base):
    """
    Photos attached to a delivery by barista.
    """
    __tablename__ = "delivery_photos"

    id = Column(Integer, primary_key=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id"), nullable=False, index=True)
    photo_url = Column(String(500), nullable=False)  # URL в S3 или локальном хранилище
    thumbnail_url = Column(String(500), nullable=True)  # Превью
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    delivery = relationship("Delivery", back_populates="photos")


class Inventory(Base):
    """
    Inventory session (Инвентаризация).
    Created by barista at end of day, reviewed by manager.
    """
    __tablename__ = "inventories"

    id = Column(Integer, primary_key=True)
    store_location_id = Column(Integer, ForeignKey("store_locations.id"), nullable=False, index=True)
    date = Column(DateTime, nullable=False)  # Дата инвентаризации
    status = Column(
        Enum(InventoryStatus, values_callable=lambda obj: [e.value for e in InventoryStatus]),
        default=InventoryStatus.DRAFT,
        nullable=False,
        index=True,
    )
    conducted_by_telegram_id = Column(Integer, nullable=True)  # Telegram ID бариста
    conducted_by_name = Column(String(255), nullable=True)  # Имя бариста
    reviewed_by_admin_id = Column(Integer, nullable=True)  # ID админа, который принял/отклонил
    reviewed_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)  # Комментарии бариста
    review_notes = Column(Text, nullable=True)  # Комментарии руководителя
    has_discrepancies = Column(Boolean, default=False, nullable=False)  # Флаг наличия расхождений
    discrepancies_within_tolerance = Column(Boolean, default=True, nullable=False)  # Все расхождения в пределах допуска
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    store_location = relationship("StoreLocation")
    lines = relationship("InventoryLine", back_populates="inventory", cascade="all, delete-orphan")


class InventoryLine(Base):
    """
    Individual item in an inventory session.
    Compares expected (calculated) vs actual (counted) quantity.
    """
    __tablename__ = "inventory_lines"

    id = Column(Integer, primary_key=True)
    inventory_id = Column(Integer, ForeignKey("inventories.id"), nullable=False, index=True)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False, index=True)
    expected_quantity = Column(Float, nullable=False)  # Расчётный остаток (приёмка - продажи - списания)
    actual_quantity = Column(Float, nullable=True)  # Фактический остаток (введённый баристой)
    discrepancy = Column(Float, nullable=True)  # actual - expected
    tolerance = Column(Float, nullable=False)  # Допуск на момент инвентаризации
    within_tolerance = Column(Boolean, nullable=True)  # В пределах допуска?
    notes = Column(Text, nullable=True)  # Комментарий

    inventory = relationship("Inventory", back_populates="lines")
    stock_item = relationship("StockItem")


class StockMovement(Base):
    """
    Log of all stock movements for audit trail.
    Every change to stock is recorded here.
    """
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False, index=True)
    store_location_id = Column(Integer, ForeignKey("store_locations.id"), nullable=False, index=True)
    movement_type = Column(String(50), nullable=False, index=True)  # delivery, sale, write_off, inventory_adjustment
    quantity = Column(Float, nullable=False)  # + для прихода, - для расхода
    quantity_before = Column(Float, nullable=False)  # Остаток до операции
    quantity_after = Column(Float, nullable=False)  # Остаток после операции
    reference_type = Column(String(50), nullable=True)  # delivery, order, inventory, manual
    reference_id = Column(Integer, nullable=True)  # ID связанного документа
    notes = Column(Text, nullable=True)
    performed_by = Column(String(255), nullable=True)  # Кто выполнил операцию
    iiko_transaction_id = Column(String(100), nullable=True)  # ID транзакции в iiko
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    stock_item = relationship("StockItem")
    store_location = relationship("StoreLocation")
