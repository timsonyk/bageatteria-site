from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.user import UserOut


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    expires_in: int
    issued_at: datetime


class AdminLogin(BaseModel):
    username: str
    password: str


class TelegramAuthRequest(BaseModel):
    """Telegram Login Widget auth data."""
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


class TelegramBotAuthRequest(BaseModel):
    """Request to initiate Telegram bot auth."""
    phone: str = Field(..., example="+79161234567")


class TelegramBotAuthStatus(BaseModel):
    """Status of Telegram bot auth."""
    status: str  # "pending", "completed", "expired"
    access_token: Optional[str] = None
    user: Optional[UserOut] = None
    expires_in: Optional[int] = None
    issued_at: Optional[datetime] = None


class TelegramBotConfirmRequest(BaseModel):
    """Request from Telegram bot to confirm auth."""
    phone: str
    telegram_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None


# SMS Auth schemas

class SMSSendCodeRequest(BaseModel):
    """Request to send SMS auth code."""
    phone: str = Field(..., example="+79161234567")


class SMSSendCodeResponse(BaseModel):
    """Response after sending SMS code."""
    status: str  # "sent", "rate_limited", "error"
    phone: str
    expires_in: int  # seconds until code expires
    retry_after: Optional[int] = None  # seconds until can retry (if rate limited)
    message: Optional[str] = None


class SMSVerifyCodeRequest(BaseModel):
    """Request to verify SMS code."""
    phone: str = Field(..., example="+79161234567")
    code: str = Field(..., min_length=4, max_length=6, example="1234")


class SMSVerifyCodeResponse(BaseModel):
    """Response after verifying SMS code."""
    status: str  # "success", "invalid_code", "expired", "max_attempts"
    access_token: Optional[str] = None
    user: Optional[UserOut] = None
    expires_in: Optional[int] = None
    issued_at: Optional[datetime] = None
    attempts_left: Optional[int] = None
    message: Optional[str] = None

