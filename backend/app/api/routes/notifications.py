from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.notification import DeviceToken, Notification
from app.schemas.notification import (
    DeviceTokenRegister,
    DeviceTokenOut,
    NotificationOut,
    NotificationMarkRead,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/device-token", response_model=DeviceTokenOut)
def register_device_token(
    payload: DeviceTokenRegister,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Register device token for push notifications"""
    # Check if token already exists
    existing = db.query(DeviceToken).filter(DeviceToken.token == payload.token).first()

    if existing:
        # Update existing token to new user if needed
        existing.user_id = user.id
        existing.platform = payload.platform
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return existing

    # Create new token
    device_token = DeviceToken(
        user_id=user.id,
        token=payload.token,
        platform=payload.platform,
        is_active=True,
    )
    db.add(device_token)
    db.commit()
    db.refresh(device_token)
    return device_token


@router.delete("/device-token")
def unregister_device_token(
    payload: DeviceTokenRegister,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Unregister device token (logout, disable notifications)"""
    token = db.query(DeviceToken).filter(
        DeviceToken.token == payload.token,
        DeviceToken.user_id == user.id,
    ).first()

    if token:
        token.is_active = False
        db.commit()

    return {"status": "ok"}


@router.get("", response_model=List[NotificationOut])
def get_notifications(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get user's notifications"""
    notifications = db.query(Notification).filter(
        (Notification.user_id == user.id) | (Notification.user_id.is_(None))
    ).order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()

    return notifications


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get count of unread notifications"""
    count = db.query(Notification).filter(
        ((Notification.user_id == user.id) | (Notification.user_id.is_(None))),
        Notification.is_read == False,
    ).count()

    return {"count": count}


@router.post("/mark-read")
def mark_notifications_read(
    payload: NotificationMarkRead,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Mark notifications as read"""
    db.query(Notification).filter(
        Notification.id.in_(payload.notification_ids),
        (Notification.user_id == user.id) | (Notification.user_id.is_(None)),
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()

    return {"status": "ok"}


@router.post("/mark-all-read")
def mark_all_read(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Mark all notifications as read"""
    db.query(Notification).filter(
        (Notification.user_id == user.id) | (Notification.user_id.is_(None)),
        Notification.is_read == False,
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()

    return {"status": "ok"}
