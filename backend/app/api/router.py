from fastapi import APIRouter

from app.api.routes import catalog, admin

api_router = APIRouter()
api_router.include_router(catalog.router)
api_router.include_router(admin.router)
