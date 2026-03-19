# Import all models here so Alembic can detect them
from app.db.session import Base  # noqa: F401

from app.models.user import User, AuthCode, Address  # noqa: F401
from app.models.loyalty import LoyaltyAccount, Referral  # noqa: F401
from app.models.catalog import (  # noqa: F401
    Category,
    Product,
    ProductSize,
    ModificationGroup,
    ModificationOption,
    Banner,
    PromoCode,
    PickupLocation,
    FAQ,
    AppText,
    DeliveryZone,
    ModificationGroupProduct,
    StoreLocation,
)
from app.models.order import Order, OrderItem, Payment  # noqa: F401
from app.models.stock import (  # noqa: F401
    StockCategory,
    StockItem,
    CurrentStock,
    Delivery,
    DeliveryLine,
    DeliveryPhoto,
    Inventory,
    InventoryLine,
    StockMovement,
)

