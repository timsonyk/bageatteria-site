# Import all models here so Alembic can detect them
from app.db.session import Base  # noqa: F401

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
from app.models.loyalty import LoyaltyCard, WalletDevice, WalletRegistration  # noqa: F401
