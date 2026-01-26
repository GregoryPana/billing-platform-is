from fastapi import APIRouter

from app.api.routes import approvals, audit, auth, cycles, notifications, runs, scripts, users


api_router = APIRouter()
api_router.include_router(cycles.router, prefix="/cycles", tags=["cycles"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(scripts.router, prefix="/scripts", tags=["scripts"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(approvals.router, prefix="/approvals", tags=["approvals"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
