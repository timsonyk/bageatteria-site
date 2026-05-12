from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db
from app.models.catalog import Banner, Category, Product, ModificationGroup, DeliveryZone, StoreLocation, FAQ, CategoryRecommendation, ProductStoreAvailability, CategoryStoreAvailability
from app.schemas.catalog import BannerOut, CategoryOut, ProductOut
from app.services.pricing import _find_delivery_zone, _point_in_polygon

router = APIRouter(prefix="/catalog", tags=["catalog"])


# --- Delivery Fee Check ---

class DeliveryCheckRequest(BaseModel):
    lat: float
    lng: float
    city: str = "Москва"


class DeliveryCheckResponse(BaseModel):
    available: bool
    delivery_fee: float
    sla_minutes: int
    min_order_total: Optional[float] = None
    zone_name: Optional[str] = None


@router.post("/delivery-check", response_model=DeliveryCheckResponse)
def check_delivery(payload: DeliveryCheckRequest, db: Session = Depends(get_db)):
    """Check delivery availability and fee for given coordinates."""
    zone = _find_delivery_zone(db, city=payload.city, lat=payload.lat, lng=payload.lng)
    
    if zone:
        return DeliveryCheckResponse(
            available=True,
            delivery_fee=float(zone.delivery_fee),
            sla_minutes=zone.sla_minutes,
            min_order_total=float(zone.min_order_total) if zone.min_order_total else None,
            zone_name=f"Зона {zone.id}"
        )
    else:
        # No zone = unavailable
        return DeliveryCheckResponse(
            available=False,
            delivery_fee=0.0,
            sla_minutes=0,
            min_order_total=None,
            zone_name=None
        )


class DeliveryZoneOut(BaseModel):
    id: int
    city: str
    polygon: Optional[list] = None
    delivery_fee: float
    sla_minutes: int
    min_order_total: Optional[float] = None
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/delivery-zones", response_model=list[DeliveryZoneOut])
def list_delivery_zones(city: str = Query("Москва"), db: Session = Depends(get_db)):
    """Get all active delivery zones for given city."""
    zones = db.query(DeliveryZone).filter(
        DeliveryZone.city == city,
        DeliveryZone.is_active == True  # noqa: E712
    ).order_by(DeliveryZone.sort_order).all()
    return zones


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    categories = db.query(Category).filter(Category.is_active == True).order_by(Category.sort_order).all()  # noqa: E712
    return categories


def _to_relative(url: str | None) -> str | None:
    """Любой URL картинки — к относительному `/uploads/...`.

    - уже относительный → оставляем;
    - абсолютный c путём `/uploads/...` (наш домен, localhost, docker-внутренний
      `backend:8000` и т.п.) → возвращаем только путь;
    - прочее абсолютное (чужой CDN) → оставляем как есть.
    Клиент сам прикрепляет публичный хост через NEXT_PUBLIC_MEDIA_URL.
    """
    if not url:
        return None
    try:
        parsed = urlparse(url)
    except Exception:
        return url
    if not parsed.scheme:
        return url
    if parsed.path.startswith("/uploads/"):
        return parsed.path
    return url


def _normalize_media_entry(entry):
    """Поддерживаем оба формата:
    - старый: "url-как-строка"
    - новый: {"url": "...", "original_url": "..."}
    Оба URL приводятся к относительному пути.
    """
    if isinstance(entry, str):
        return _to_relative(entry)
    if isinstance(entry, dict):
        result = dict(entry)
        if result.get("url"):
            result["url"] = _to_relative(result["url"])
        if result.get("original_url"):
            result["original_url"] = _to_relative(result["original_url"])
        return result
    return entry


def _normalize_product_media(product: ProductOut) -> ProductOut:
    data = product.model_dump()
    if data.get("media"):
        data["media"] = [_normalize_media_entry(m) for m in data["media"]]
    if data.get("featured_mobile_image"):
        data["featured_mobile_image"] = _to_relative(data["featured_mobile_image"])
    if data.get("featured_desktop_image"):
        data["featured_desktop_image"] = _to_relative(data["featured_desktop_image"])
    for group in data.get("modification_groups", []):
        for option in group.get("options", []):
            option["image_url"] = _to_relative(option.get("image_url"))
    return ProductOut(**data)


@router.get("/products", response_model=list[ProductOut])
def list_products(
    category_id: int | None = Query(None),
    store_location_id: int | None = Query(None),
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    query = db.query(Product).options(
        joinedload(Product.sizes),
        joinedload(Product.modification_groups).joinedload(ModificationGroup.options),
    )
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if active_only:
        query = query.filter(Product.is_active == True)  # noqa: E712

    # Filter by store location if specified
    if store_location_id:
        available_product_ids = db.query(ProductStoreAvailability.product_id).filter(
            ProductStoreAvailability.store_location_id == store_location_id
        ).subquery()
        query = query.filter(Product.id.in_(available_product_ids))

        # Также фильтруем по доступности КАТЕГОРИИ на этой точке.
        # Логика: если у категории ВООБЩЕ есть записи в CategoryStoreAvailability,
        # она считается «настроенной» — товар показываем только если эта точка в её записях.
        # Если записей нет вообще — категория доступна везде (back-compat).
        configured_category_ids = db.query(
            CategoryStoreAvailability.category_id
        ).distinct().subquery()
        available_category_ids = db.query(
            CategoryStoreAvailability.category_id
        ).filter(
            CategoryStoreAvailability.store_location_id == store_location_id
        ).subquery()
        query = query.filter(
            or_(
                Product.category_id.notin_(configured_category_ids),
                Product.category_id.in_(available_category_ids),
            )
        )

    products = query.order_by(Product.sort_order).all()
    return [_normalize_product_media(ProductOut.model_validate(p)) for p in products]


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = (
        db.query(Product)
        .options(
            joinedload(Product.sizes),
            joinedload(Product.modification_groups).joinedload(ModificationGroup.options),
        )
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _normalize_product_media(ProductOut.model_validate(product))


@router.get("/banners", response_model=list[BannerOut])
def list_banners(db: Session = Depends(get_db)):
    banners = (
        db.query(Banner)
        .filter(Banner.is_active == True)  # noqa: E712
        .order_by(Banner.sort_order)
        .all()
    )
    out: list[BannerOut] = []
    for b in banners:
        dto = BannerOut.model_validate(b)
        dto = BannerOut(**{**dto.model_dump(), "image_url": _to_relative(dto.image_url)})
        out.append(dto)
    return out


@router.get("/store_locations")
def list_store_locations(db: Session = Depends(get_db)):
    """Get list of store locations (public)."""
    return db.query(StoreLocation).filter(StoreLocation.is_active == True).order_by(StoreLocation.sort_order).all()


@router.get("/store_locations/by-slug/{slug}")
def get_store_location_by_slug(slug: str, db: Session = Depends(get_db)):
    """Get store location by slug (for QR code links)."""
    location = db.query(StoreLocation).filter(
        StoreLocation.slug == slug,
        StoreLocation.is_active == True
    ).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.get("/faqs")
def list_faqs(db: Session = Depends(get_db)):
    """Get list of FAQs (public)."""
    return db.query(FAQ).filter(FAQ.is_active == True).order_by(FAQ.sort_order).all()


@router.get("/recommendations/{category_id}", response_model=list[ProductOut])
def get_recommendations(
    category_id: int,
    db: Session = Depends(get_db),
):
    """Get recommended products for a category."""
    # Get recommendations sorted by sort_order
    recs = db.query(CategoryRecommendation).filter(
        CategoryRecommendation.category_id == category_id
    ).order_by(CategoryRecommendation.sort_order).all()

    if not recs:
        return []

    product_ids = [r.product_id for r in recs]

    # Fetch products with their relations
    products = db.query(Product).options(
        joinedload(Product.sizes),
        joinedload(Product.modification_groups).joinedload(ModificationGroup.options),
    ).filter(
        Product.id.in_(product_ids),
        Product.is_active == True  # noqa: E712
    ).all()

    # Sort products by the order in recommendations
    products_dict = {p.id: p for p in products}
    sorted_products = [products_dict[pid] for pid in product_ids if pid in products_dict]
    return [_normalize_product_media(ProductOut.model_validate(p)) for p in sorted_products]

