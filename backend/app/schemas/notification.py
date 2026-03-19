from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel

from app.models.notification import NotificationType, DevicePlatform


# Device Token Schemas
class DeviceTokenRegister(BaseModel):
    token: str
    platform: DevicePlatform = DevicePlatform.IOS


class DeviceTokenOut(BaseModel):
    id: int
    token: str
    platform: DevicePlatform
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Notification Schemas
class NotificationOut(BaseModel):
    id: int
    title: str
    body: str
    notification_type: NotificationType
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationMarkRead(BaseModel):
    notification_ids: List[int]


# Push Campaign Schemas (Admin)
class PushCampaignCreate(BaseModel):
    title: str
    body: str
    notification_type: NotificationType = NotificationType.PROMO


class PushCampaignOut(BaseModel):
    id: int
    title: str
    body: str
    notification_type: NotificationType
    sent_count: int
    failed_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class PushSendResponse(BaseModel):
    success: bool
    campaign_id: int
    sent_count: int
    failed_count: int
    message: str
