import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)

app = FastAPI(title="Bageatteria API", version="0.1.0")

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
settings = get_settings()
is_dev = settings.app_env in ("local", "development")
allowed_origins: list[str] = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

if is_dev:
    # В dev добавляем стандартные localhost-порты для удобства разработки.
    allowed_origins.extend([
        "http://localhost:3000", "http://localhost:3001",
        "http://localhost:5173", "http://localhost:5174",
        "http://localhost:5175", "http://localhost:5176",
        "http://127.0.0.1:3000", "http://127.0.0.1:3001",
        "http://127.0.0.1:5173", "http://127.0.0.1:5174",
        "http://127.0.0.1:5175", "http://127.0.0.1:5176",
    ])

if not allowed_origins:
    # В production пустой список означает мисконфиг — бросаем ошибку, не открываем "*".
    raise RuntimeError(
        "CORS_ORIGINS не задан. В production пусто = ошибка конфигурации, "
        "wildcard не разрешён."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Добавляет базовые security-заголовки ко всем ответам."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=()",
        )
        if not is_dev:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Ensure uploads directory exists and serve static files
settings = get_settings()
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}


app.include_router(api_router)

