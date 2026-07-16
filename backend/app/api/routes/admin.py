from typing import Optional
import logging
import os
import uuid
import io
from decimal import Decimal, ROUND_HALF_UP
from PIL import Image

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Response, status, Query, UploadFile, File, Request
from sqlalchemy.orm import Session, joinedload

from app.api.admin_deps import clear_admin_cookie, get_admin_user, set_admin_cookie
from app.api.deps import get_db
from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.core.security import constant_time_compare, verify_password
from app.models import catalog as cat_models
from app.schemas import admin as admin_schemas

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/login")
@limiter.limit("5/minute")  # Max 5 login attempts per minute per IP
def admin_login(request: Request, payload: admin_schemas.AdminLoginRequest, response: Response):
    settings = get_settings()
    # Сначала проверяем username за константное время.
    username_ok = constant_time_compare(payload.username, settings.admin_username)
    # Пароль: предпочитаем bcrypt-хэш, fallback — plaintext (для dev).
    if settings.admin_password_hash:
        password_ok = verify_password(payload.password, settings.admin_password_hash)
    elif settings.admin_password:
        password_ok = constant_time_compare(payload.password, settings.admin_password)
    else:
        # Если ни хэша, ни plaintext не задано — никто не может войти.
        password_ok = False
    if not (username_ok and password_ok):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    set_admin_cookie(response, username=payload.username)
    return {"authenticated": True, "username": payload.username}


@router.post("/logout")
def admin_logout(response: Response):
    clear_admin_cookie(response)
    return {"logged_out": True}


@router.get("/session")
def admin_session(user=Depends(get_admin_user)):
    return {"authenticated": True, "username": user["username"]}


# -------- Catalog CRUD --------
@router.get("/categories")
def list_categories(db: Session = Depends(get_db), user=Depends(get_admin_user)):
    return db.query(cat_models.Category).order_by(cat_models.Category.sort_order).all()


@router.post("/categories")
def create_category(payload: admin_schemas.CategoryCreate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = cat_models.Category(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/categories/{category_id}")
def update_category(category_id: int, payload: admin_schemas.CategoryUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.Category).filter(cat_models.Category.id == category_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.Category).filter(cat_models.Category.id == category_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


@router.post("/categories/bulk_sort")
def bulk_update_category_sort_order(
    payload: admin_schemas.CategorySortOrderBulkUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Bulk update sort_order for categories"""
    if not payload.items:
        return {"updated": 0}

    category_ids = [item.id for item in payload.items]
    categories = db.query(cat_models.Category).filter(cat_models.Category.id.in_(category_ids)).all()
    categories_map = {c.id: c for c in categories}

    updated = 0
    for item in payload.items:
        if item.id in categories_map:
            categories_map[item.id].sort_order = item.sort_order
            updated += 1

    db.commit()
    return {"updated": updated}


@router.get("/products")
def list_products(category_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    q = db.query(cat_models.Product)
    if category_id:
        q = q.filter(cat_models.Product.category_id == category_id)
    return q.order_by(cat_models.Product.sort_order).all()


@router.post("/products")
def create_product(payload: admin_schemas.ProductCreate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = cat_models.Product(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/products/{product_id}")
def update_product(product_id: int, payload: admin_schemas.ProductUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.Product).filter(cat_models.Product.id == product_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Product not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/products/bulk_price")
def bulk_update_product_prices(
    payload: admin_schemas.BulkPriceUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    if payload.percent == 0:
        return {"updated_products": 0, "updated_sizes": 0}
    if payload.percent <= -100:
        raise HTTPException(status_code=400, detail="percent must be greater than -100")
    if (not payload.apply_to_all) and (not payload.product_ids):
        raise HTTPException(status_code=400, detail="product_ids is required unless apply_to_all=true")

    multiplier = Decimal("1") + (Decimal(str(payload.percent)) / Decimal("100"))
    if multiplier <= 0:
        raise HTTPException(status_code=400, detail="Invalid percent value")

    def q2(amount: Decimal) -> Decimal:
        return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    q = db.query(cat_models.Product)
    if payload.apply_to_sizes:
        q = q.options(joinedload(cat_models.Product.sizes))
    if not payload.apply_to_all:
        q = q.filter(cat_models.Product.id.in_(payload.product_ids))

    products = q.all()
    if not products:
        raise HTTPException(status_code=404, detail="No products found for update")

    updated_sizes = 0
    for p in products:
        # SQLAlchemy Numeric -> Decimal; keep as Decimal with 2 digits
        p.base_price = q2(Decimal(p.base_price) * multiplier)
        if payload.apply_to_sizes:
            for s in p.sizes:
                s.base_price = q2(Decimal(s.base_price) * multiplier)
                updated_sizes += 1

    db.commit()
    return {"updated_products": len(products), "updated_sizes": updated_sizes, "multiplier": float(multiplier)}


@router.post("/products/bulk_sort")
def bulk_update_product_sort_order(
    payload: admin_schemas.ProductSortOrderBulkUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Bulk update sort_order for multiple products"""
    if not payload.items:
        return {"updated": 0}

    product_ids = [item.id for item in payload.items]
    products = db.query(cat_models.Product).filter(cat_models.Product.id.in_(product_ids)).all()
    products_map = {p.id: p for p in products}

    updated = 0
    for item in payload.items:
        if item.id in products_map:
            products_map[item.id].sort_order = item.sort_order
            updated += 1

    db.commit()
    return {"updated": updated}


@router.post("/highlights/order")
def bulk_update_highlights_order(
    payload: admin_schemas.HighlightsOrderUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Bulk update sort order for one of the highlights collections.

    flag: "recommended_menu" | "recommended_favorites" | "featured_menu"
    Sets <flag>_order = index for each product in the list.
    """
    column_map = {
        "recommended_menu": "recommended_menu_order",
        "recommended_favorites": "recommended_favorites_order",
        "featured_menu": "featured_menu_order",
    }
    column = column_map.get(payload.flag)
    if column is None:
        raise HTTPException(status_code=400, detail="Unknown highlights flag")

    if not payload.product_ids:
        return {"updated": 0}

    products = db.query(cat_models.Product).filter(
        cat_models.Product.id.in_(payload.product_ids)
    ).all()
    products_map = {p.id: p for p in products}

    updated = 0
    for index, pid in enumerate(payload.product_ids):
        product = products_map.get(pid)
        if product is None:
            continue
        setattr(product, column, index)
        updated += 1

    db.commit()
    return {"updated": updated}


@router.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.Product).filter(cat_models.Product.id == product_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


@router.get("/product_sizes")
def list_product_sizes(product_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    q = db.query(cat_models.ProductSize)
    if product_id:
        q = q.filter(cat_models.ProductSize.product_id == product_id)
    return q.order_by(cat_models.ProductSize.sort_order).all()


@router.post("/product_sizes")
def create_product_size(payload: admin_schemas.ProductSizeCreate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = cat_models.ProductSize(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/product_sizes/{size_id}")
def update_product_size(size_id: int, payload: admin_schemas.ProductSizeUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.ProductSize).filter(cat_models.ProductSize.id == size_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Size not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/product_sizes/{size_id}")
def delete_product_size(size_id: int, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.ProductSize).filter(cat_models.ProductSize.id == size_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Size not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


@router.get("/modification_groups")
def list_modification_groups(product_id: Optional[int] = None, category_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    q = db.query(cat_models.ModificationGroup).options(joinedload(cat_models.ModificationGroup.products))
    if product_id:
        q = q.join(cat_models.ModificationGroupProduct).filter(cat_models.ModificationGroupProduct.product_id == product_id)
    return q.order_by(cat_models.ModificationGroup.sort_order).all()


@router.post("/modification_groups")
def create_modification_group(payload: admin_schemas.ModificationGroupCreate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    type_value = str(payload.type or "single").lower()
    if type_value not in ("single", "multiple"):
        raise HTTPException(status_code=400, detail="Invalid modification group type")
    try:
        mod_type = cat_models.ModificationType(type_value)
    except ValueError:
        mod_type = cat_models.ModificationType.SINGLE
    obj = cat_models.ModificationGroup(
        name=payload.name,
        min_count=payload.min_count,
        max_count=payload.max_count,
        type=mod_type,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    if payload.product_ids:
        products = db.query(cat_models.Product).filter(cat_models.Product.id.in_(payload.product_ids)).all()
        obj.products = products
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/modification_groups/{group_id}")
def update_modification_group(group_id: int, payload: admin_schemas.ModificationGroupUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.ModificationGroup).filter(cat_models.ModificationGroup.id == group_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Group not found")
    data = payload.model_dump(exclude_unset=True)
    product_ids = data.pop("product_ids", None)
    if "type" in data and data["type"]:
        t = str(data["type"]).lower()
        if t not in ("single", "multiple"):
            raise HTTPException(status_code=400, detail="Invalid modification group type")
        try:
            data["type"] = cat_models.ModificationType(t)
        except ValueError:
            data["type"] = cat_models.ModificationType.SINGLE
    for k, v in data.items():
        setattr(obj, k, v)
    if product_ids is not None:
        products = db.query(cat_models.Product).filter(cat_models.Product.id.in_(product_ids)).all()
        obj.products = products
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/modification_groups/{group_id}")
def delete_modification_group(group_id: int, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.ModificationGroup).filter(cat_models.ModificationGroup.id == group_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Group not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


@router.get("/modification_options")
def list_modification_options(group_id: Optional[int] = None, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    q = db.query(cat_models.ModificationOption)
    if group_id:
        q = q.filter(cat_models.ModificationOption.group_id == group_id)
    return q.order_by(cat_models.ModificationOption.sort_order).all()


@router.post("/modification_options")
def create_modification_option(payload: admin_schemas.ModificationOptionCreate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = cat_models.ModificationOption(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/modification_options/{option_id}")
def update_modification_option(option_id: int, payload: admin_schemas.ModificationOptionUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.ModificationOption).filter(cat_models.ModificationOption.id == option_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Option not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/modification_options/{option_id}")
def delete_modification_option(option_id: int, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.ModificationOption).filter(cat_models.ModificationOption.id == option_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Option not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


# -------- Marketing --------
@router.get("/banners")
def list_banners(db: Session = Depends(get_db), user=Depends(get_admin_user)):
    return db.query(cat_models.Banner).order_by(cat_models.Banner.sort_order).all()


@router.post("/banners")
def create_banner(payload: admin_schemas.BannerCreate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = cat_models.Banner(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/banners/{banner_id}")
def update_banner(banner_id: int, payload: admin_schemas.BannerUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.Banner).filter(cat_models.Banner.id == banner_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Banner not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/banners/{banner_id}")
def delete_banner(banner_id: int, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.Banner).filter(cat_models.Banner.id == banner_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Banner not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


@router.get("/promo_codes")
def list_promo_codes(db: Session = Depends(get_db), user=Depends(get_admin_user)):
    return db.query(cat_models.PromoCode).all()


@router.post("/promo_codes")
def create_promo_code(payload: admin_schemas.PromoCodeCreate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = cat_models.PromoCode(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/promo_codes/{promo_id}")
def update_promo_code(promo_id: int, payload: admin_schemas.PromoCodeUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.PromoCode).filter(cat_models.PromoCode.id == promo_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Promo not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/promo_codes/{promo_id}")
def delete_promo_code(promo_id: int, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.PromoCode).filter(cat_models.PromoCode.id == promo_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Promo not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


# -------- Delivery --------
@router.get("/pickup_locations")
def list_pickups(db: Session = Depends(get_db), user=Depends(get_admin_user)):
    return db.query(cat_models.PickupLocation).order_by(cat_models.PickupLocation.sort_order).all()


@router.post("/pickup_locations")
def create_pickup(payload: admin_schemas.PickupLocationCreate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = cat_models.PickupLocation(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/pickup_locations/{pickup_id}")
def update_pickup(pickup_id: int, payload: admin_schemas.PickupLocationUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.PickupLocation).filter(cat_models.PickupLocation.id == pickup_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Pickup not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/pickup_locations/{pickup_id}")
def delete_pickup(pickup_id: int, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.PickupLocation).filter(cat_models.PickupLocation.id == pickup_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Pickup not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


@router.get("/delivery_zones")
def list_delivery_zones(db: Session = Depends(get_db), user=Depends(get_admin_user)):
    return db.query(cat_models.DeliveryZone).order_by(cat_models.DeliveryZone.sort_order).all()


@router.post("/delivery_zones")
def create_delivery_zone(payload: admin_schemas.DeliveryZoneCreate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = cat_models.DeliveryZone(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/delivery_zones/{zone_id}")
def update_delivery_zone(zone_id: int, payload: admin_schemas.DeliveryZoneUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.DeliveryZone).filter(cat_models.DeliveryZone.id == zone_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Zone not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/delivery_zones/{zone_id}")
def delete_delivery_zone(zone_id: int, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.DeliveryZone).filter(cat_models.DeliveryZone.id == zone_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Zone not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


# -------- Settings --------
@router.get("/faqs")
def list_faqs(db: Session = Depends(get_db), user=Depends(get_admin_user)):
    return db.query(cat_models.FAQ).order_by(cat_models.FAQ.sort_order).all()


@router.post("/faqs")
def create_faq(payload: admin_schemas.FAQCreate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = cat_models.FAQ(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/faqs/{faq_id}")
def update_faq(faq_id: int, payload: admin_schemas.FAQUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.FAQ).filter(cat_models.FAQ.id == faq_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="FAQ not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/faqs/{faq_id}")
def delete_faq(faq_id: int, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.FAQ).filter(cat_models.FAQ.id == faq_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="FAQ not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


# -------- Store Locations --------
@router.get("/store_locations")
def list_store_locations_admin(db: Session = Depends(get_db), user=Depends(get_admin_user)):
    return db.query(cat_models.StoreLocation).order_by(cat_models.StoreLocation.sort_order).all()


@router.post("/store_locations")
def create_store_location(payload: admin_schemas.StoreLocationCreate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    data = payload.model_dump()
    # Auto-generate name from address if not provided
    if not data.get("name"):
        data["name"] = data["address_text"][:50] if data.get("address_text") else "Новая точка"
    obj = cat_models.StoreLocation(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/store_locations/{location_id}")
def update_store_location(location_id: int, payload: admin_schemas.StoreLocationUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.StoreLocation).filter(cat_models.StoreLocation.id == location_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Store location not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/store_locations/{location_id}")
def delete_store_location(location_id: int, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.StoreLocation).filter(cat_models.StoreLocation.id == location_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Store location not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


@router.get("/app_texts")
def list_app_texts(db: Session = Depends(get_db), user=Depends(get_admin_user)):
    return db.query(cat_models.AppText).all()


@router.put("/app_texts")
def update_app_text(payload: admin_schemas.AppTextUpdate, db: Session = Depends(get_db), user=Depends(get_admin_user)):
    obj = db.query(cat_models.AppText).filter(cat_models.AppText.key == payload.key).first()
    if not obj:
        obj = cat_models.AppText(key=payload.key, value=payload.value)
        db.add(obj)
    else:
        obj.value = payload.value
    db.commit()
    db.refresh(obj)
    return obj


# -------- Uploads --------

# SECURITY: Allowed file types for upload
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
ALLOWED_IMAGE_MIMES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
MAX_UPLOAD_SIZE = 20 * 1024 * 1024  # 20 MB
TARGET_IMAGE_SIZE = (1200, 1200)  # Max dimensions after compression
JPEG_QUALITY = 85  # Quality for JPEG compression


@router.post("/upload")
@limiter.limit("60/hour")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    user=Depends(get_admin_user),
):
    settings = get_settings()

    # SECURITY: Validate file extension
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )

    # SECURITY: Validate MIME type
    if file.content_type and file.content_type not in ALLOWED_IMAGE_MIMES:
        raise HTTPException(status_code=400, detail=f"MIME type not allowed: {file.content_type}")

    # SECURITY: Read content and check size
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_UPLOAD_SIZE // (1024*1024)} MB"
        )

    os.makedirs(settings.upload_dir, exist_ok=True)

    # Compress images (except SVG and GIF)
    compressible_extensions = {".jpg", ".jpeg", ".png", ".webp"}
    if ext in compressible_extensions:
        try:
            img = Image.open(io.BytesIO(content))

            # Convert RGBA to RGB for JPEG (if needed)
            if img.mode in ("RGBA", "P") and ext in {".jpg", ".jpeg"}:
                img = img.convert("RGB")
            elif img.mode == "P":
                img = img.convert("RGBA" if "transparency" in img.info else "RGB")

            # Resize if larger than target size while maintaining aspect ratio
            img.thumbnail(TARGET_IMAGE_SIZE, Image.Resampling.LANCZOS)

            # Save compressed image
            output = io.BytesIO()
            if ext in {".jpg", ".jpeg"}:
                img.save(output, format="JPEG", quality=JPEG_QUALITY, optimize=True)
                save_ext = ".jpg"
            elif ext == ".png":
                img.save(output, format="PNG", optimize=True)
                save_ext = ".png"
            elif ext == ".webp":
                img.save(output, format="WEBP", quality=JPEG_QUALITY)
                save_ext = ".webp"
            else:
                save_ext = ext

            content = output.getvalue()
            ext = save_ext
        except Exception:
            # If compression fails, save original file
            pass

    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.upload_dir, filename)

    with open(file_path, "wb") as f:
        f.write(content)

    # Return relative URL; host is applied at display time (public API normalizes, admin prepends).
    url = f"/uploads/{filename}"
    return {"url": url, "filename": filename}


# -------- Category Recommendations --------
@router.get("/recommendations")
def list_recommendations(
    category_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Get recommendations, optionally filtered by category"""
    q = db.query(cat_models.CategoryRecommendation).options(
        joinedload(cat_models.CategoryRecommendation.product),
        joinedload(cat_models.CategoryRecommendation.category),
    )
    if category_id:
        q = q.filter(cat_models.CategoryRecommendation.category_id == category_id)
    return q.order_by(
        cat_models.CategoryRecommendation.category_id,
        cat_models.CategoryRecommendation.sort_order,
    ).all()


@router.post("/recommendations")
def create_recommendation(
    payload: admin_schemas.CategoryRecommendationCreate,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Create a single recommendation"""
    # Check if already exists
    existing = db.query(cat_models.CategoryRecommendation).filter(
        cat_models.CategoryRecommendation.category_id == payload.category_id,
        cat_models.CategoryRecommendation.product_id == payload.product_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Recommendation already exists")

    obj = cat_models.CategoryRecommendation(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/recommendations/{rec_id}")
def update_recommendation(
    rec_id: int,
    payload: admin_schemas.CategoryRecommendationUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Update a recommendation"""
    obj = db.query(cat_models.CategoryRecommendation).filter(
        cat_models.CategoryRecommendation.id == rec_id
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/recommendations/{rec_id}")
def delete_recommendation(
    rec_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Delete a recommendation"""
    obj = db.query(cat_models.CategoryRecommendation).filter(
        cat_models.CategoryRecommendation.id == rec_id
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


@router.post("/recommendations/bulk")
def bulk_update_recommendations(
    payload: admin_schemas.CategoryRecommendationsBulkUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Replace all recommendations for a category with new list"""
    # Delete existing recommendations for this category
    db.query(cat_models.CategoryRecommendation).filter(
        cat_models.CategoryRecommendation.category_id == payload.category_id
    ).delete()

    # Create new recommendations
    for i, product_id in enumerate(payload.product_ids):
        obj = cat_models.CategoryRecommendation(
            category_id=payload.category_id,
            product_id=product_id,
            sort_order=i,
        )
        db.add(obj)

    db.commit()

    # Return newly created recommendations
    return db.query(cat_models.CategoryRecommendation).options(
        joinedload(cat_models.CategoryRecommendation.product),
    ).filter(
        cat_models.CategoryRecommendation.category_id == payload.category_id
    ).order_by(cat_models.CategoryRecommendation.sort_order).all()


# -------- Product Store Availability --------
@router.get("/product_availability")
def list_product_availability(
    product_id: Optional[int] = None,
    store_location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Get product availability records, optionally filtered"""
    q = db.query(cat_models.ProductStoreAvailability).options(
        joinedload(cat_models.ProductStoreAvailability.product),
        joinedload(cat_models.ProductStoreAvailability.store_location),
    )
    if product_id:
        q = q.filter(cat_models.ProductStoreAvailability.product_id == product_id)
    if store_location_id:
        q = q.filter(cat_models.ProductStoreAvailability.store_location_id == store_location_id)
    return q.all()


@router.post("/product_availability")
def create_product_availability(
    payload: admin_schemas.ProductAvailabilityCreate,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Add product availability at a store"""
    # Check if already exists
    existing = db.query(cat_models.ProductStoreAvailability).filter(
        cat_models.ProductStoreAvailability.product_id == payload.product_id,
        cat_models.ProductStoreAvailability.store_location_id == payload.store_location_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Availability already exists")

    obj = cat_models.ProductStoreAvailability(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/product_availability/{availability_id}")
def delete_product_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Remove product availability at a store"""
    obj = db.query(cat_models.ProductStoreAvailability).filter(
        cat_models.ProductStoreAvailability.id == availability_id
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Availability not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


@router.post("/product_availability/bulk")
def bulk_update_product_availability(
    payload: admin_schemas.ProductAvailabilityBulkUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Replace all store availability for a product"""
    # Delete existing availability for this product
    db.query(cat_models.ProductStoreAvailability).filter(
        cat_models.ProductStoreAvailability.product_id == payload.product_id
    ).delete()

    # Create new availability records
    for store_id in payload.store_location_ids:
        obj = cat_models.ProductStoreAvailability(
            product_id=payload.product_id,
            store_location_id=store_id,
        )
        db.add(obj)

    db.commit()

    # Return newly created records
    return db.query(cat_models.ProductStoreAvailability).options(
        joinedload(cat_models.ProductStoreAvailability.store_location),
    ).filter(
        cat_models.ProductStoreAvailability.product_id == payload.product_id
    ).all()


# -------- Category Store Availability --------
@router.get("/category_availability")
def list_category_availability(
    category_id: Optional[int] = None,
    store_location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Get category availability records, optionally filtered"""
    q = db.query(cat_models.CategoryStoreAvailability).options(
        joinedload(cat_models.CategoryStoreAvailability.category),
        joinedload(cat_models.CategoryStoreAvailability.store_location),
    )
    if category_id:
        q = q.filter(cat_models.CategoryStoreAvailability.category_id == category_id)
    if store_location_id:
        q = q.filter(cat_models.CategoryStoreAvailability.store_location_id == store_location_id)
    return q.all()


@router.post("/category_availability")
def create_category_availability(
    payload: admin_schemas.CategoryAvailabilityCreate,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Add category availability at a store"""
    # Check if already exists
    existing = db.query(cat_models.CategoryStoreAvailability).filter(
        cat_models.CategoryStoreAvailability.category_id == payload.category_id,
        cat_models.CategoryStoreAvailability.store_location_id == payload.store_location_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Availability already exists")

    obj = cat_models.CategoryStoreAvailability(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/category_availability/{availability_id}")
def delete_category_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Remove category availability at a store"""
    obj = db.query(cat_models.CategoryStoreAvailability).filter(
        cat_models.CategoryStoreAvailability.id == availability_id
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Availability not found")
    db.delete(obj)
    db.commit()
    return {"deleted": True}


@router.post("/category_availability/bulk")
def bulk_update_category_availability(
    payload: admin_schemas.CategoryAvailabilityBulkUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_admin_user),
):
    """Replace all store availability for a category"""
    # Delete existing availability for this category
    db.query(cat_models.CategoryStoreAvailability).filter(
        cat_models.CategoryStoreAvailability.category_id == payload.category_id
    ).delete()

    # Create new availability records
    for store_id in payload.store_location_ids:
        obj = cat_models.CategoryStoreAvailability(
            category_id=payload.category_id,
            store_location_id=store_id,
        )
        db.add(obj)

    db.commit()

    # Return newly created records
    return db.query(cat_models.CategoryStoreAvailability).options(
        joinedload(cat_models.CategoryStoreAvailability.store_location),
    ).filter(
        cat_models.CategoryStoreAvailability.category_id == payload.category_id
    ).all()


