from fastapi import APIRouter

from app.api.routes import catalog, admin, wallet

api_router = APIRouter()
api_router.include_router(catalog.router)
api_router.include_router(admin.router)
api_router.include_router(wallet.router)
