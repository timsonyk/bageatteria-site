from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Response, status
from jose import jwt, JWTError

from app.core.config import get_settings


SESSION_COOKIE = "admin_session"


def _decode_session(token: str) -> Optional[str]:
    settings = get_settings()
    try:
        data = jwt.decode(token, settings.admin_cookie_secret, algorithms=[settings.jwt_algorithm])
        return data.get("sub")
    except JWTError:
        return None


def get_admin_user(session: Optional[str] = Cookie(None, alias=SESSION_COOKIE)):
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    username = _decode_session(session)
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return {"username": username}


def set_admin_cookie(response: Response, username: str):
    settings = get_settings()
    token = jwt.encode({"sub": username}, settings.admin_cookie_secret, algorithm=settings.jwt_algorithm)

    # Use secure cookie in production (requires HTTPS)
    is_production = settings.app_env not in ("local", "development")

    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=is_production,  # True in production (HTTPS required)
        samesite="lax" if not is_production else "strict",
        path="/",
        max_age=60 * 60 * 24 * 7,  # 7 days
    )


def clear_admin_cookie(response: Response):
    response.delete_cookie(key=SESSION_COOKIE, path="/")


