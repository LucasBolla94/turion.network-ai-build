from fastapi import APIRouter
from app.api.v1.endpoints import auth, health, billing, builder, apps

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(billing.router)
api_router.include_router(builder.router)
api_router.include_router(apps.router)
