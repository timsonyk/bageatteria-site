import math
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.catalog import (
    DeliveryZone,
    ModificationOption,
    ModificationGroupProduct,
    Product,
    ProductSize,
    PromoCode,
    DiscountType,
)
from app.models.order import DeliveryType


def _point_in_polygon(lat: float, lng: float, polygon: Optional[list[list[float]]]) -> bool:
    if not polygon:
        return False
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        intersects = ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / (yj - yi) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def _find_delivery_zone(db: Session, city: str, lat: float, lng: float) -> Optional[DeliveryZone]:
    zones = (
        db.query(DeliveryZone)
        .filter(DeliveryZone.city == city, DeliveryZone.is_active == True)  # noqa: E712
        .order_by(DeliveryZone.sort_order)
        .all()
    )
    for zone in zones:
        if zone.polygon and _point_in_polygon(lat, lng, zone.polygon):
            return zone
    return None


def _apply_promo(db: Session, promo_code: Optional[str], subtotal: float, city: Optional[str]) -> Tuple[float, Optional[int]]:
    if not promo_code:
        return 0.0, None
    now = datetime.now(timezone.utc)
    promo = (
        db.query(PromoCode)
        .filter(
            PromoCode.code == promo_code,
            PromoCode.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not promo:
        raise HTTPException(status_code=400, detail="Promo code not found")
    if promo.starts_at and promo.starts_at > now:
        raise HTTPException(status_code=400, detail="Promo not started")
    if promo.ends_at and promo.ends_at < now:
        raise HTTPException(status_code=400, detail="Promo expired")
    if promo.min_order_total and subtotal < float(promo.min_order_total):
        raise HTTPException(status_code=400, detail="Order total too low for promo")

    discount = 0.0
    if promo.discount_type == DiscountType.PERCENT:
        discount = subtotal * float(promo.discount_value) / 100.0
    else:
        discount = float(promo.discount_value)
    return min(discount, subtotal), promo.id


def calculate_totals(
    db: Session,
    items_payload: List[dict],
    promo_code: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    city: Optional[str] = None,
    delivery_type: str = "delivery",
) -> dict:
    subtotal = 0.0
    item_details = []

    for item in items_payload:
        product = db.query(Product).filter(Product.id == item["product_id"]).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item['product_id']} not found")
        base_price = float(product.base_price)

        if item.get("size_id"):
            size = db.query(ProductSize).filter(ProductSize.id == item["size_id"]).first()
            if not size:
                raise HTTPException(status_code=404, detail=f"Size {item['size_id']} not found")
            base_price = float(size.base_price)

        mods_total = 0.0
        mods_details = []
        for opt_id in item.get("modification_option_ids", []):
            opt = (
                db.query(ModificationOption)
                .join(ModificationOption.group)
                .join(ModificationGroupProduct, ModificationGroupProduct.group_id == ModificationOption.group_id)
                .filter(ModificationOption.id == opt_id, ModificationGroupProduct.product_id == product.id)
                .first()
            )
            if not opt:
                raise HTTPException(status_code=404, detail=f"Modification option {opt_id} not found for product {product.id}")
            mods_total += float(opt.extra_price)
            mods_details.append({"id": opt.id, "name": opt.name, "extra_price": float(opt.extra_price)})

        unit_price = base_price + mods_total
        quantity = item.get("quantity", 1)
        total_price = unit_price * quantity
        subtotal += total_price

        item_details.append(
            {
                "product_id": product.id,
                "size_id": item.get("size_id"),
                "quantity": quantity,
                "base_price": base_price,
                "final_price": unit_price,
                "modifications_json": mods_details,
            }
        )

    discount, promo_id = _apply_promo(db, promo_code, subtotal, city)

    delivery_fee = 0.0
    delivery_zone_id = None
    if delivery_type == DeliveryType.DELIVERY.value:
        if lat is not None and lng is not None and city:
            zone = _find_delivery_zone(db, city=city, lat=lat, lng=lng)
            if zone:
                delivery_fee = float(zone.delivery_fee)
                delivery_zone_id = zone.id
        if delivery_fee == 0.0:
            delivery_fee = 700.0  # fallback flat fee

    total = max(subtotal - discount, 0) + delivery_fee
    loyalty_earned = total * 0.05

    return {
        "subtotal": round(subtotal, 2),
        "discount": round(discount, 2),
        "delivery_fee": round(delivery_fee, 2),
        "total": round(total, 2),
        "loyalty_earned": round(loyalty_earned, 2),
        "promo_code_id": promo_id,
        "delivery_zone_id": delivery_zone_id,
        "items": item_details,
    }

