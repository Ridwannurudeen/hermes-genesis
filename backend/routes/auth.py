from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

import config
from auth import create_admin_session, is_admin_key, request_is_admin


router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=512)


@router.get("/status")
async def auth_status(request: Request) -> dict:
    return {
        "auth_required": bool(config.API_KEY),
        "admin": request_is_admin(request),
        "session_ttl_seconds": config.ADMIN_SESSION_TTL_SECONDS,
    }


@router.post("/login")
async def login(req: LoginRequest, request: Request, response: Response) -> dict:
    if not config.API_KEY:
        raise HTTPException(503, "GENESIS_API_KEY is not configured")
    if not is_admin_key(req.api_key):
        raise HTTPException(403, "invalid admin key")

    token = create_admin_session()
    response.set_cookie(
        key=config.ADMIN_SESSION_COOKIE,
        value=token,
        max_age=config.ADMIN_SESSION_TTL_SECONDS,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="strict",
        path="/",
    )
    return {"admin": True, "session_ttl_seconds": config.ADMIN_SESSION_TTL_SECONDS}


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(config.ADMIN_SESSION_COOKIE, path="/")
    return {"admin": False}
