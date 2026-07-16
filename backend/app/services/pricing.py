from typing import Optional

from sqlalchemy.orm import Session

from app.models.catalog import DeliveryZone


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
