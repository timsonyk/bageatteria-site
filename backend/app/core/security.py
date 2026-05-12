import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt as _bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings


def constant_time_compare(a: str, b: str) -> bool:
    """Сравнение за константное время — защита от timing-атак при сравнении plaintext-паролей."""
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def mask_secret(value: str, visible: int = 6) -> str:
    """Маскирует секретное значение для логов: показывает только первые `visible` символов."""
    if not value:
        return ""
    if len(value) <= visible:
        return "*" * len(value)
    return value[:visible] + "…"


def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.jwt_algorithm)


def verify_token(token: str) -> Optional[str]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except JWTError:
        return None


def get_password_hash(password: str) -> str:
    """bcrypt-хэш. Используем напрямую bcrypt — passlib 1.7.4 не дружит с bcrypt 4.x."""
    return _bcrypt.hashpw(
        password.encode("utf-8")[:72],
        _bcrypt.gensalt(),
    ).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля. Напрямую через bcrypt (минуя passlib)."""
    try:
        return _bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("ascii"),
        )
    except (ValueError, TypeError):
        return False

