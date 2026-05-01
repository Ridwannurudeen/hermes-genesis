from fastapi import APIRouter, HTTPException, Request

from auth import request_is_admin
from usage import usage_snapshot


router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/usage")
async def usage(request: Request) -> dict:
    if not request_is_admin(request):
        raise HTTPException(403, "admin auth required")
    return usage_snapshot()
