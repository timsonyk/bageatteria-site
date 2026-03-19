from fastapi import APIRouter

from app.api.routes import auth, catalog, orders, profile, promo, admin, notifications, stock

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(catalog.router)
api_router.include_router(orders.router)
api_router.include_router(profile.router)
api_router.include_router(promo.router)
api_router.include_router(admin.router)
api_router.include_router(notifications.router)
api_router.include_router(stock.router)

