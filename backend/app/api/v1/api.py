# backend/app/api/v1/api.py
from fastapi import APIRouter
from app.api.v1.endpoints import admin, auth, users, groups, reports, messages, realtime, media

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(messages.router, prefix="/groups", tags=["messages"])
api_router.include_router(realtime.router, tags=["realtime"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(media.router, tags=["media"])
