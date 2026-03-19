"""
Stock management API routes.

Endpoints for:
- Stock categories and items management
- Deliveries (приёмки) - create, receive, view
- Inventories (инвентаризации) - create, submit, review
- Current stock levels
- Stock movements history
- Dashboard for admin panel
"""

import os
from datetime import datetime, date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Header
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db
from app.api.admin_deps import get_admin_user


# Telegram bot API key for internal endpoints
TELEGRAM_BOT_API_KEY = os.getenv("TELEGRAM_BOT_API_KEY")


def verify_telegram_bot_key(x_bot_api_key: Optional[str] = Header(None, alias="X-Bot-API-Key")):
    """Verify that request comes from authorized Telegram bot."""
    if not TELEGRAM_BOT_API_KEY:
        # If no API key configured, allow (for development)
        return True

    if not x_bot_api_key or x_bot_api_key != TELEGRAM_BOT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing bot API key")

    return True


from app.models.stock import (
    StockCategory,
    StockItem,
    CurrentStock,
    Delivery,
    DeliveryLine,
    DeliveryPhoto,
    Inventory,
    InventoryLine,
    StockMovement,
    DeliveryStatus,
    InventoryStatus,
)
from app.models.catalog import StoreLocation
from app.schemas.stock import (
    StockCategoryCreate,
    StockCategoryUpdate,
    StockCategoryOut,
    StockItemCreate,
    StockItemUpdate,
    StockItemOut,
    CurrentStockOut,
    CurrentStockByLocation,
    DeliveryCreate,
    DeliveryUpdate,
    DeliveryOut,
    DeliveryListOut,
    DeliveryLineUpdate,
    InventoryCreate,
    InventoryUpdate,
    InventoryOut,
    InventoryListOut,
    InventoryLineUpdate,
    StockMovementOut,
    TelegramDeliveryReceiveRequest,
    TelegramInventorySubmitRequest,
    StockDashboard,
    StockDashboardLocation,
)

router = APIRouter(prefix="/admin/stock", tags=["stock"])


# ============ Stock Categories ============

@router.get("/categories", response_model=List[StockCategoryOut])
def list_stock_categories(
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """List all stock categories."""
    return db.query(StockCategory).order_by(StockCategory.sort_order).all()


@router.post("/categories", response_model=StockCategoryOut)
def create_stock_category(
    data: StockCategoryCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Create a new stock category."""
    category = StockCategory(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=StockCategoryOut)
def update_stock_category(
    category_id: int,
    data: StockCategoryUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Update a stock category."""
    category = db.query(StockCategory).filter(StockCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(category, key, value)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}")
def delete_stock_category(
    category_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Delete a stock category."""
    category = db.query(StockCategory).filter(StockCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    db.delete(category)
    db.commit()
    return {"ok": True}


# ============ Stock Items ============

@router.get("/items", response_model=List[StockItemOut])
def list_stock_items(
    category_id: Optional[int] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """List stock items with optional filters."""
    query = db.query(StockItem).options(joinedload(StockItem.stock_category))

    if category_id:
        query = query.filter(StockItem.stock_category_id == category_id)
    if active_only:
        query = query.filter(StockItem.is_active == True)

    return query.order_by(StockItem.sort_order).all()


@router.post("/items", response_model=StockItemOut)
def create_stock_item(
    data: StockItemCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Create a new stock item."""
    item = StockItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/items/{item_id}", response_model=StockItemOut)
def update_stock_item(
    item_id: int,
    data: StockItemUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Update a stock item."""
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}")
def delete_stock_item(
    item_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Delete a stock item."""
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(item)
    db.commit()
    return {"ok": True}


# ============ Current Stock ============

@router.get("/current", response_model=List[CurrentStockByLocation])
def get_current_stock(
    store_location_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Get current stock levels, grouped by location."""
    locations_query = db.query(StoreLocation).filter(StoreLocation.is_active == True)
    if store_location_id:
        locations_query = locations_query.filter(StoreLocation.id == store_location_id)

    locations = locations_query.order_by(StoreLocation.sort_order).all()
    result = []

    for location in locations:
        stocks = (
            db.query(CurrentStock)
            .options(joinedload(CurrentStock.stock_item).joinedload(StockItem.stock_category))
            .filter(CurrentStock.store_location_id == location.id)
            .all()
        )
        result.append(CurrentStockByLocation(
            store_location_id=location.id,
            store_location_name=location.name,
            items=[CurrentStockOut.model_validate(s) for s in stocks],
        ))

    return result


@router.get("/current/{location_id}", response_model=List[CurrentStockOut])
def get_current_stock_by_location(
    location_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Get current stock for a specific location."""
    return (
        db.query(CurrentStock)
        .options(joinedload(CurrentStock.stock_item).joinedload(StockItem.stock_category))
        .filter(CurrentStock.store_location_id == location_id)
        .all()
    )


# ============ Deliveries ============

@router.get("/deliveries", response_model=List[DeliveryListOut])
def list_deliveries(
    store_location_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """List deliveries with filters."""
    query = (
        db.query(Delivery)
        .options(joinedload(Delivery.store_location))
        .options(joinedload(Delivery.lines))
        .options(joinedload(Delivery.photos))
    )

    if store_location_id:
        query = query.filter(Delivery.store_location_id == store_location_id)
    if status:
        query = query.filter(Delivery.status == status)
    if date_from:
        query = query.filter(Delivery.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Delivery.created_at <= datetime.combine(date_to, datetime.max.time()))

    deliveries = query.order_by(Delivery.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for d in deliveries:
        has_discrepancies = any(
            line.actual_quantity is not None and line.actual_quantity != line.expected_quantity
            for line in d.lines
        )
        result.append(DeliveryListOut(
            id=d.id,
            store_location_id=d.store_location_id,
            store_location_name=d.store_location.name if d.store_location else None,
            delivery_number=d.delivery_number,
            supplier_name=d.supplier_name,
            expected_date=d.expected_date,
            actual_date=d.actual_date,
            status=d.status.value if hasattr(d.status, 'value') else d.status,
            received_by_name=d.received_by_name,
            lines_count=len(d.lines),
            photos_count=len(d.photos),
            has_discrepancies=has_discrepancies,
            created_at=d.created_at,
        ))

    return result


@router.get("/deliveries/{delivery_id}", response_model=DeliveryOut)
def get_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Get delivery details."""
    delivery = (
        db.query(Delivery)
        .options(joinedload(Delivery.lines).joinedload(DeliveryLine.stock_item))
        .options(joinedload(Delivery.photos))
        .filter(Delivery.id == delivery_id)
        .first()
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return delivery


@router.post("/deliveries", response_model=DeliveryOut)
def create_delivery(
    data: DeliveryCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Create a new expected delivery."""
    delivery = Delivery(
        store_location_id=data.store_location_id,
        delivery_number=data.delivery_number,
        supplier_name=data.supplier_name,
        expected_date=data.expected_date,
        notes=data.notes,
        status=DeliveryStatus.PENDING,
    )
    db.add(delivery)
    db.flush()

    for line_data in data.lines:
        line = DeliveryLine(
            delivery_id=delivery.id,
            stock_item_id=line_data.stock_item_id,
            expected_quantity=line_data.expected_quantity,
        )
        db.add(line)

    db.commit()
    db.refresh(delivery)
    return delivery


@router.put("/deliveries/{delivery_id}", response_model=DeliveryOut)
def update_delivery(
    delivery_id: int,
    data: DeliveryUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Update delivery details."""
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(delivery, key, value)

    db.commit()
    db.refresh(delivery)
    return delivery


@router.delete("/deliveries/{delivery_id}")
def delete_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Delete a delivery."""
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    db.delete(delivery)
    db.commit()
    return {"ok": True}


# ============ Inventories ============

@router.get("/inventories", response_model=List[InventoryListOut])
def list_inventories(
    store_location_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """List inventories with filters."""
    query = (
        db.query(Inventory)
        .options(joinedload(Inventory.store_location))
        .options(joinedload(Inventory.lines))
    )

    if store_location_id:
        query = query.filter(Inventory.store_location_id == store_location_id)
    if status:
        query = query.filter(Inventory.status == status)
    if date_from:
        query = query.filter(Inventory.date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Inventory.date <= datetime.combine(date_to, datetime.max.time()))

    inventories = query.order_by(Inventory.date.desc()).offset(offset).limit(limit).all()

    result = []
    for inv in inventories:
        result.append(InventoryListOut(
            id=inv.id,
            store_location_id=inv.store_location_id,
            store_location_name=inv.store_location.name if inv.store_location else None,
            date=inv.date,
            status=inv.status.value if hasattr(inv.status, 'value') else inv.status,
            conducted_by_name=inv.conducted_by_name,
            has_discrepancies=inv.has_discrepancies,
            discrepancies_within_tolerance=inv.discrepancies_within_tolerance,
            lines_count=len(inv.lines),
            created_at=inv.created_at,
        ))

    return result


@router.get("/inventories/{inventory_id}", response_model=InventoryOut)
def get_inventory(
    inventory_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Get inventory details."""
    inventory = (
        db.query(Inventory)
        .options(joinedload(Inventory.lines).joinedload(InventoryLine.stock_item))
        .filter(Inventory.id == inventory_id)
        .first()
    )
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")
    return inventory


@router.post("/inventories/{inventory_id}/accept")
def accept_inventory(
    inventory_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Accept an inventory and update stock levels."""
    inventory = (
        db.query(Inventory)
        .options(joinedload(Inventory.lines))
        .filter(Inventory.id == inventory_id)
        .first()
    )
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")

    if inventory.status not in [InventoryStatus.SUBMITTED, InventoryStatus.OK, InventoryStatus.DISCREPANCY]:
        raise HTTPException(status_code=400, detail="Inventory cannot be accepted in current status")

    # Update stock levels based on actual quantities
    for line in inventory.lines:
        if line.actual_quantity is None:
            continue

        current_stock = (
            db.query(CurrentStock)
            .filter(
                CurrentStock.stock_item_id == line.stock_item_id,
                CurrentStock.store_location_id == inventory.store_location_id,
            )
            .first()
        )

        if not current_stock:
            current_stock = CurrentStock(
                stock_item_id=line.stock_item_id,
                store_location_id=inventory.store_location_id,
                quantity=0,
            )
            db.add(current_stock)
            db.flush()

        old_quantity = current_stock.quantity
        adjustment = line.actual_quantity - line.expected_quantity

        if adjustment != 0:
            # Record movement for the adjustment
            movement = StockMovement(
                stock_item_id=line.stock_item_id,
                store_location_id=inventory.store_location_id,
                movement_type="inventory_adjustment",
                quantity=adjustment,
                quantity_before=old_quantity,
                quantity_after=line.actual_quantity,
                reference_type="inventory",
                reference_id=inventory.id,
                notes=f"Инвентаризация #{inventory.id}",
                performed_by=f"Admin",
            )
            db.add(movement)

        current_stock.quantity = line.actual_quantity

    inventory.status = InventoryStatus.ACCEPTED
    inventory.reviewed_at = datetime.utcnow()

    db.commit()
    return {"ok": True, "message": "Inventory accepted and stock levels updated"}


@router.post("/inventories/{inventory_id}/reject")
def reject_inventory(
    inventory_id: int,
    review_notes: Optional[str] = None,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Reject an inventory."""
    inventory = db.query(Inventory).filter(Inventory.id == inventory_id).first()
    if not inventory:
        raise HTTPException(status_code=404, detail="Inventory not found")

    inventory.status = InventoryStatus.REJECTED
    inventory.reviewed_at = datetime.utcnow()
    if review_notes:
        inventory.review_notes = review_notes

    db.commit()
    return {"ok": True}


# ============ Stock Movements ============

@router.get("/movements", response_model=List[StockMovementOut])
def list_stock_movements(
    store_location_id: Optional[int] = None,
    stock_item_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """List stock movements (audit log)."""
    query = db.query(StockMovement).options(joinedload(StockMovement.stock_item))

    if store_location_id:
        query = query.filter(StockMovement.store_location_id == store_location_id)
    if stock_item_id:
        query = query.filter(StockMovement.stock_item_id == stock_item_id)
    if movement_type:
        query = query.filter(StockMovement.movement_type == movement_type)
    if date_from:
        query = query.filter(StockMovement.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(StockMovement.created_at <= datetime.combine(date_to, datetime.max.time()))

    return query.order_by(StockMovement.created_at.desc()).offset(offset).limit(limit).all()


# ============ Dashboard ============

@router.get("/dashboard", response_model=StockDashboard)
def get_stock_dashboard(
    db: Session = Depends(get_db),
    admin=Depends(get_admin_user),
):
    """Get stock management dashboard data."""
    locations = db.query(StoreLocation).filter(StoreLocation.is_active == True).all()
    today = date.today()

    location_data = []
    total_pending = 0
    total_inv_pending = 0

    for loc in locations:
        # Pending deliveries count
        pending_deliveries = (
            db.query(func.count(Delivery.id))
            .filter(
                Delivery.store_location_id == loc.id,
                Delivery.status == DeliveryStatus.PENDING,
            )
            .scalar()
        )

        # Deliveries with discrepancies
        discrepancy_deliveries = (
            db.query(func.count(Delivery.id))
            .filter(
                Delivery.store_location_id == loc.id,
                Delivery.status == DeliveryStatus.HAS_DISCREPANCY,
            )
            .scalar()
        )

        # Today's inventory status
        today_inv = (
            db.query(Inventory)
            .filter(
                Inventory.store_location_id == loc.id,
                func.date(Inventory.date) == today,
            )
            .first()
        )

        inv_status = None
        if today_inv:
            inv_status = today_inv.status.value if hasattr(today_inv.status, 'value') else today_inv.status
            if inv_status in ['submitted', 'ok', 'discrepancy']:
                total_inv_pending += 1

        total_pending += pending_deliveries

        location_data.append(StockDashboardLocation(
            store_location_id=loc.id,
            store_location_name=loc.name,
            pending_deliveries=pending_deliveries,
            deliveries_with_discrepancies=discrepancy_deliveries,
            today_inventory_status=inv_status,
        ))

    return StockDashboard(
        locations=location_data,
        total_pending_deliveries=total_pending,
        total_inventories_pending_review=total_inv_pending,
    )


# ============ Telegram Bot Endpoints ============

@router.get("/telegram/pending-deliveries/{store_location_id}")
def get_pending_deliveries_for_telegram(
    store_location_id: int,
    db: Session = Depends(get_db),
    _auth: bool = Depends(verify_telegram_bot_key),
):
    """Get pending deliveries for Telegram bot (requires bot API key)."""
    deliveries = (
        db.query(Delivery)
        .options(joinedload(Delivery.lines).joinedload(DeliveryLine.stock_item))
        .filter(
            Delivery.store_location_id == store_location_id,
            Delivery.status.in_([DeliveryStatus.PENDING, DeliveryStatus.IN_PROGRESS]),
        )
        .order_by(Delivery.expected_date)
        .all()
    )
    return deliveries


@router.post("/telegram/receive-delivery")
def telegram_receive_delivery(
    data: TelegramDeliveryReceiveRequest,
    db: Session = Depends(get_db),
    _auth: bool = Depends(verify_telegram_bot_key),
):
    """Receive a delivery from Telegram bot (requires bot API key)."""
    delivery = (
        db.query(Delivery)
        .options(joinedload(Delivery.lines))
        .filter(Delivery.id == data.delivery_id)
        .first()
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # Update delivery
    delivery.status = DeliveryStatus.COMPLETED
    delivery.actual_date = datetime.utcnow()
    delivery.received_by_telegram_id = data.telegram_id
    delivery.received_by_name = data.telegram_name

    has_discrepancy = False

    # Update lines
    for line_update in data.lines:
        for line in delivery.lines:
            if line.stock_item_id == line_update.stock_item_id if hasattr(line_update, 'stock_item_id') else True:
                if line_update.actual_quantity is not None:
                    line.actual_quantity = line_update.actual_quantity
                    if line.actual_quantity != line.expected_quantity:
                        has_discrepancy = True
                if line_update.discrepancy_reason:
                    line.discrepancy_reason = line_update.discrepancy_reason
                if line_update.discrepancy_notes:
                    line.discrepancy_notes = line_update.discrepancy_notes

    if has_discrepancy:
        delivery.status = DeliveryStatus.HAS_DISCREPANCY

    # Update stock levels
    for line in delivery.lines:
        qty = line.actual_quantity if line.actual_quantity is not None else line.expected_quantity

        current_stock = (
            db.query(CurrentStock)
            .filter(
                CurrentStock.stock_item_id == line.stock_item_id,
                CurrentStock.store_location_id == delivery.store_location_id,
            )
            .first()
        )

        if not current_stock:
            current_stock = CurrentStock(
                stock_item_id=line.stock_item_id,
                store_location_id=delivery.store_location_id,
                quantity=0,
            )
            db.add(current_stock)
            db.flush()

        old_qty = current_stock.quantity
        current_stock.quantity += qty

        # Record movement
        movement = StockMovement(
            stock_item_id=line.stock_item_id,
            store_location_id=delivery.store_location_id,
            movement_type="delivery",
            quantity=qty,
            quantity_before=old_qty,
            quantity_after=current_stock.quantity,
            reference_type="delivery",
            reference_id=delivery.id,
            performed_by=data.telegram_name,
        )
        db.add(movement)

    db.commit()
    return {"ok": True, "delivery_id": delivery.id, "has_discrepancy": has_discrepancy}


@router.get("/telegram/stock-items/{store_location_id}")
def get_stock_items_for_inventory(
    store_location_id: int,
    db: Session = Depends(get_db),
    _auth: bool = Depends(verify_telegram_bot_key),
):
    """Get stock items with current quantities for inventory (requires bot API key)."""
    items = (
        db.query(StockItem)
        .options(joinedload(StockItem.stock_category))
        .filter(StockItem.is_active == True)
        .order_by(StockItem.stock_category_id, StockItem.sort_order)
        .all()
    )

    # Get current stock
    current_stocks = {
        cs.stock_item_id: cs.quantity
        for cs in db.query(CurrentStock)
        .filter(CurrentStock.store_location_id == store_location_id)
        .all()
    }

    result = []
    for item in items:
        category = item.stock_category
        result.append({
            "id": item.id,
            "name": item.name,
            "category_id": category.id if category else None,
            "category_name": category.name if category else None,
            "unit": item.unit or (category.unit.value if category and hasattr(category.unit, 'value') else category.unit if category else "pieces"),
            "tolerance": item.tolerance if item.tolerance is not None else (category.tolerance if category else 0),
            "expected_quantity": current_stocks.get(item.id, 0),
        })

    return result


@router.post("/telegram/submit-inventory")
def telegram_submit_inventory(
    data: TelegramInventorySubmitRequest,
    db: Session = Depends(get_db),
    _auth: bool = Depends(verify_telegram_bot_key),
):
    """Submit inventory from Telegram bot (requires bot API key)."""
    today = date.today()

    # SECURITY: Check for duplicate inventory on the same day for same location
    existing_inventory = (
        db.query(Inventory)
        .filter(
            Inventory.store_location_id == data.store_location_id,
            func.date(Inventory.date) == today,
            Inventory.status.notin_([InventoryStatus.REJECTED]),
        )
        .first()
    )

    if existing_inventory:
        raise HTTPException(
            status_code=400,
            detail=f"Инвентаризация для этой точки уже проведена сегодня (ID: {existing_inventory.id})"
        )

    # Create inventory
    inventory = Inventory(
        store_location_id=data.store_location_id,
        date=datetime.utcnow(),
        status=InventoryStatus.SUBMITTED,
        conducted_by_telegram_id=data.telegram_id,
        conducted_by_name=data.telegram_name,
        notes=data.notes,
    )
    db.add(inventory)
    db.flush()

    has_discrepancies = False
    all_within_tolerance = True

    # Get current stock for comparison
    current_stocks = {
        cs.stock_item_id: cs.quantity
        for cs in db.query(CurrentStock)
        .filter(CurrentStock.store_location_id == data.store_location_id)
        .all()
    }

    for line_data in data.lines:
        item = db.query(StockItem).options(joinedload(StockItem.stock_category)).filter(StockItem.id == line_data.stock_item_id).first()
        if not item:
            continue

        expected = current_stocks.get(line_data.stock_item_id, 0)
        actual = line_data.actual_quantity
        discrepancy = (actual - expected) if actual is not None else None

        # Get tolerance
        tolerance = item.tolerance if item.tolerance is not None else (item.stock_category.tolerance if item.stock_category else 0)

        within_tolerance = True
        if discrepancy is not None and abs(discrepancy) > tolerance:
            within_tolerance = False
            all_within_tolerance = False

        if discrepancy is not None and discrepancy != 0:
            has_discrepancies = True

        line = InventoryLine(
            inventory_id=inventory.id,
            stock_item_id=line_data.stock_item_id,
            expected_quantity=expected,
            actual_quantity=actual,
            discrepancy=discrepancy,
            tolerance=tolerance,
            within_tolerance=within_tolerance,
            notes=line_data.notes,
        )
        db.add(line)

    inventory.has_discrepancies = has_discrepancies
    inventory.discrepancies_within_tolerance = all_within_tolerance

    # Auto-approve if no discrepancies or all within tolerance
    if not has_discrepancies or all_within_tolerance:
        inventory.status = InventoryStatus.OK
    else:
        inventory.status = InventoryStatus.DISCREPANCY

    db.commit()

    return {
        "ok": True,
        "inventory_id": inventory.id,
        "status": inventory.status.value if hasattr(inventory.status, 'value') else inventory.status,
        "has_discrepancies": has_discrepancies,
        "all_within_tolerance": all_within_tolerance,
    }


@router.post("/telegram/upload-photo/{delivery_id}")
async def telegram_upload_delivery_photo(
    delivery_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _auth: bool = Depends(verify_telegram_bot_key),
):
    """Upload a photo for delivery from Telegram bot (requires bot API key)."""
    import uuid

    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # SECURITY: Validate file type
    allowed_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    allowed_mime_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}

    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(allowed_extensions)}")

    if file.content_type and file.content_type not in allowed_mime_types:
        raise HTTPException(status_code=400, detail=f"MIME type not allowed: {file.content_type}")

    # SECURITY: Limit file size (10 MB max)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)} MB")

    # Save file
    upload_dir = "uploads/delivery_photos"
    os.makedirs(upload_dir, exist_ok=True)

    # SECURITY: Use UUID filename, ignore original extension from user
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    # Create photo record
    photo = DeliveryPhoto(
        delivery_id=delivery_id,
        photo_url=f"/uploads/delivery_photos/{filename}",
    )
    db.add(photo)
    db.commit()

    return {"ok": True, "photo_id": photo.id, "photo_url": photo.photo_url}
