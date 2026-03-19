import hashlib
import hmac
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import create_access_token
from app.models.user import User, AuthCode
from app.schemas.auth import (
    TelegramAuthRequest, TokenResponse,
    TelegramBotAuthRequest, TelegramBotAuthStatus, TelegramBotConfirmRequest,
    SMSSendCodeRequest, SMSSendCodeResponse,
    SMSVerifyCodeRequest, SMSVerifyCodeResponse
)
from app.schemas.user import UserOut
from app.core.config import get_settings
from app.services.sms import send_auth_code, generate_code


router = APIRouter(prefix="/auth", tags=["auth"])


def validate_telegram_auth(data: TelegramAuthRequest, bot_token: str) -> bool:
    """
    Validate Telegram Login Widget authentication data.
    
    Based on: https://core.telegram.org/widgets/login#checking-authorization
    
    Args:
        data: Telegram auth data
        bot_token: Telegram bot token
        
    Returns:
        bool: True if valid, False otherwise
    """
    # Create data check string
    check_data = {
        'id': str(data.id),
        'auth_date': str(data.auth_date),
    }
    
    if data.first_name:
        check_data['first_name'] = data.first_name
    if data.last_name:
        check_data['last_name'] = data.last_name
    if data.username:
        check_data['username'] = data.username
    if data.photo_url:
        check_data['photo_url'] = data.photo_url
    
    # Sort keys and create check string
    data_check_string = '\n'.join([f"{k}={v}" for k, v in sorted(check_data.items())])
    
    # Create secret key from bot token
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    
    # Calculate HMAC-SHA256
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    
    return calculated_hash == data.hash


# Store for pending and completed Telegram bot auth
# In production, use Redis or database
_telegram_bot_auth: dict[str, dict] = {}

# Store for confirmed auth from Telegram bot (phone -> auth_data)
_confirmed_auth: dict[str, dict] = {}


def normalize_phone(phone: str) -> str:
    """Normalize phone number to +7XXXXXXXXXX format."""
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    elif digits.startswith("7") and len(digits) == 11:
        pass
    elif len(digits) == 10:
        digits = "7" + digits
    return f"+{digits}"


def generate_guest_code(db: Session) -> int:
    """Генерирует уникальный последовательный код гостя."""
    from sqlalchemy import func
    max_code = db.query(func.max(User.guest_code)).scalar()
    return (max_code or 0) + 1


@router.post("/telegram-bot/init", response_model=dict)
def init_telegram_bot_auth(payload: TelegramBotAuthRequest):
    """
    Initialize Telegram bot authentication.
    Returns the bot username for deep linking.
    """
    import time

    phone = normalize_phone(payload.phone)

    # Store pending auth with timestamp
    _telegram_bot_auth[f"pending:{phone}"] = {
        "phone": phone,
        "timestamp": time.time(),
        "status": "pending"
    }

    return {
        "status": "pending",
        "phone": phone,
        "bot_username": "bageatteria_bot",
        "deep_link": f"https://t.me/bageatteria_bot?start=auth"
    }


@router.post("/telegram-bot/confirm")
def confirm_telegram_bot_auth(payload: TelegramBotConfirmRequest, db: Session = Depends(get_db)):
    """
    Called by Telegram bot when user shares their phone number.
    Creates or updates user and stores auth confirmation.
    """
    import time

    phone = normalize_phone(payload.phone)

    # Find or create user
    user = db.query(User).filter(User.phone == phone).first()

    if not user:
        # Create new user with guest_code
        name = f"{payload.first_name or ''} {payload.last_name or ''}".strip() or None
        guest_code = generate_guest_code(db)
        user = User(
            phone=phone,
            telegram_id=payload.telegram_id,
            name=name,
            guest_code=guest_code,
        )
        db.add(user)
    else:
        # Assign guest_code if not set
        if not user.guest_code:
            user.guest_code = generate_guest_code(db)
        # Update telegram_id if not set
        if not user.telegram_id:
            user.telegram_id = payload.telegram_id
        # Update name if not set
        if not user.name and (payload.first_name or payload.last_name):
            user.name = f"{payload.first_name or ''} {payload.last_name or ''}".strip()

    db.commit()
    db.refresh(user)

    # Create token
    token = create_access_token(subject=user.phone)

    # Store confirmed auth (expires in 10 minutes)
    _confirmed_auth[phone] = {
        "token": token,
        "user": user,
        "timestamp": time.time(),
        "expires": time.time() + 600,
    }

    return {"status": "ok", "phone": phone}


@router.post("/telegram-bot/check", response_model=TelegramBotAuthStatus)
def check_telegram_bot_auth(payload: TelegramBotAuthRequest, db: Session = Depends(get_db)):
    """
    Check if Telegram bot authentication is completed.
    The app polls this endpoint after redirecting user to Telegram.
    """
    import time

    phone = normalize_phone(payload.phone)

    # Check confirmed auth from Telegram bot
    auth_data = _confirmed_auth.get(phone)
    if auth_data:
        # Check if not expired
        if auth_data.get("expires", 0) > time.time():
            settings = get_settings()
            user = auth_data["user"]
            # Remove from store after use
            del _confirmed_auth[phone]
            return TelegramBotAuthStatus(
                status="completed",
                access_token=auth_data["token"],
                user=UserOut.model_validate(user),
                expires_in=settings.access_token_expire_minutes * 60,
                issued_at=datetime.now(timezone.utc)
            )
        else:
            # Expired
            del _confirmed_auth[phone]

    return TelegramBotAuthStatus(status="pending")


@router.post("/telegram", response_model=TokenResponse)
def telegram_auth(payload: TelegramAuthRequest, db: Session = Depends(get_db)):
    """
    Authenticate user via Telegram Login Widget.
    
    Validates the HMAC signature and creates or logs in the user.
    """
    settings = get_settings()
    
    # Check if telegram bot token is configured
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=503, detail="Telegram authentication not configured")
    
    # Validate auth_date (must be within last 24 hours)
    current_timestamp = int(datetime.now(timezone.utc).timestamp())
    if current_timestamp - payload.auth_date > 86400:  # 24 hours
        raise HTTPException(status_code=400, detail="Authentication data is too old")
    
    # Validate HMAC signature
    if not validate_telegram_auth(payload, settings.telegram_bot_token):
        raise HTTPException(status_code=401, detail="Invalid authentication signature")
    
    # Find existing user by telegram_id
    user = db.query(User).filter(User.telegram_id == payload.id).first()

    if not user:
        # User must first authenticate via auth bot to share their phone number
        raise HTTPException(
            status_code=403,
            detail="phone_required",
        )

    # Update user name if provided and not set
    if not user.name and (payload.first_name or payload.last_name):
        user.name = f"{payload.first_name or ''} {payload.last_name or ''}".strip()
    
    db.commit()
    db.refresh(user)
    
    # Create access token (using phone as subject)
    token = create_access_token(subject=user.phone)
    
    return TokenResponse(
        access_token=token,
        user=UserOut.model_validate(user),
        expires_in=settings.access_token_expire_minutes * 60,
        issued_at=datetime.now(timezone.utc),
    )


# In-memory attempts tracking (use Redis in production)
_sms_attempts: dict[str, int] = {}


@router.post("/sms/send-code", response_model=SMSSendCodeResponse)
async def sms_send_code(
    payload: SMSSendCodeRequest,
    db: Session = Depends(get_db)
):
    """
    Send SMS authentication code to phone number.

    Rate limiting: 1 SMS per minute per phone number.
    Code expires after 5 minutes.
    """
    settings = get_settings()
    phone = normalize_phone(payload.phone)
    now = datetime.now(timezone.utc)

    # Check rate limiting - find last code sent to this phone
    last_code = db.query(AuthCode).filter(
        AuthCode.phone == phone,
        AuthCode.created_at > now - timedelta(minutes=settings.sms_rate_limit_minutes)
    ).order_by(AuthCode.created_at.desc()).first()

    if last_code:
        # Calculate time since last code was created (using UTC)
        last_code_time = last_code.created_at
        if last_code_time.tzinfo is None:
            last_code_time = last_code_time.replace(tzinfo=timezone.utc)
        time_since = (now - last_code_time).total_seconds()
        retry_after = int(settings.sms_rate_limit_minutes * 60 - time_since)
        if retry_after > 0:
            return SMSSendCodeResponse(
                status="rate_limited",
                phone=phone,
                expires_in=0,
                retry_after=max(1, retry_after),
                message="Подождите перед повторной отправкой"
            )

    # Generate and save new code
    code = generate_code(4)
    expires_at = now + timedelta(minutes=settings.sms_code_expire_minutes)

    auth_code = AuthCode(
        phone=phone,
        code=code,
        expires_at=expires_at,
        consumed=False
    )
    db.add(auth_code)
    db.commit()

    # Send SMS
    sent = await send_auth_code(phone, code)

    if not sent:
        return SMSSendCodeResponse(
            status="error",
            phone=phone,
            expires_in=0,
            message="Не удалось отправить SMS. Попробуйте позже."
        )

    return SMSSendCodeResponse(
        status="sent",
        phone=phone,
        expires_in=settings.sms_code_expire_minutes * 60
    )


@router.post("/sms/verify-code", response_model=SMSVerifyCodeResponse)
def sms_verify_code(
    payload: SMSVerifyCodeRequest,
    db: Session = Depends(get_db)
):
    """
    Verify SMS authentication code and return access token.

    Max 3 attempts per code.
    """
    settings = get_settings()
    phone = normalize_phone(payload.phone)
    now = datetime.now(timezone.utc)

    # Find the latest non-consumed, non-expired code for this phone
    auth_code = db.query(AuthCode).filter(
        AuthCode.phone == phone,
        AuthCode.consumed == False,
        AuthCode.expires_at > now
    ).order_by(AuthCode.created_at.desc()).first()

    if not auth_code:
        return SMSVerifyCodeResponse(
            status="expired",
            message="Код истёк или не был отправлен. Запросите новый код."
        )

    # Check attempts
    attempts_key = f"sms_attempts:{auth_code.id}"
    attempts = _sms_attempts.get(attempts_key, 0)

    if attempts >= settings.sms_max_attempts:
        # Mark code as consumed (blocked)
        auth_code.consumed = True
        db.commit()
        _sms_attempts.pop(attempts_key, None)
        return SMSVerifyCodeResponse(
            status="max_attempts",
            message="Превышено количество попыток. Запросите новый код."
        )

    # Verify code
    if auth_code.code != payload.code:
        _sms_attempts[attempts_key] = attempts + 1
        attempts_left = settings.sms_max_attempts - attempts - 1
        return SMSVerifyCodeResponse(
            status="invalid_code",
            attempts_left=attempts_left,
            message=f"Неверный код. Осталось попыток: {attempts_left}"
        )

    # Code is correct - mark as consumed
    auth_code.consumed = True
    db.commit()
    _sms_attempts.pop(attempts_key, None)

    # Find or create user
    user = db.query(User).filter(User.phone == phone).first()

    if not user:
        guest_code = generate_guest_code(db)
        user = User(phone=phone, guest_code=guest_code)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Assign guest_code if not set
        if not user.guest_code:
            user.guest_code = generate_guest_code(db)
            db.commit()
            db.refresh(user)

    # Create access token
    token = create_access_token(subject=user.phone)

    return SMSVerifyCodeResponse(
        status="success",
        access_token=token,
        user=UserOut.model_validate(user),
        expires_in=settings.access_token_expire_minutes * 60,
        issued_at=datetime.now(timezone.utc)
    )

