import hmac

import bcrypt as _bcrypt


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
