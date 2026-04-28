import hmac
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from config import HOST, PORT, API_KEY, CORS_ORIGINS
from routes.worlds import router as worlds_router
from routes.simulate import router as simulate_router
from routes.stream import router as stream_router
from routes.scenes import router as scenes_router
from chroniclon.routes import router as chronicle_router
from telegram_bot import create_bot
from llm import close_client
from rate_limit import rate_limit_middleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    bot = create_bot()
    if bot:
        await bot.initialize()
        await bot.start()
        await bot.updater.start_polling()
    yield
    # Shutdown
    await close_client()
    from telegram_bot import _bot_app
    if _bot_app:
        await _bot_app.updater.stop()
        await _bot_app.stop()
        await _bot_app.shutdown()


app = FastAPI(title="Hermes Genesis", version="0.1.0", lifespan=lifespan)

# CORS: restrict to configured origins, fall back to permissive only when none set
_cors_origins = CORS_ORIGINS if CORS_ORIGINS else ["*"]
if not CORS_ORIGINS:
    import logging
    logging.getLogger(__name__).warning("CORS_ORIGINS not set — allowing all origins. Set CORS_ORIGINS in .env for production.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    allow_credentials=bool(CORS_ORIGINS),
)

app.add_middleware(GZipMiddleware, minimum_size=500)


# API key gate on mutating routes (POST/DELETE) when GENESIS_API_KEY is set.
# Origin header is client-controlled so cannot be trusted for auth bypass.
@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    if API_KEY and request.method in ("POST", "DELETE") and request.url.path.startswith("/api/"):
        key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
        if not key or not hmac.compare_digest(key, API_KEY):
            return JSONResponse(status_code=403, content={"detail": "Invalid or missing API key"})
    return await call_next(request)


# Rate limiting on LLM-calling endpoints
app.middleware("http")(rate_limit_middleware)


app.include_router(worlds_router)
app.include_router(simulate_router)
app.include_router(stream_router)
app.include_router(scenes_router)
app.include_router(chronicle_router)

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0", "auth_required": bool(API_KEY)}

# Serve frontend static files (in production, after Docker build copies dist/ to static/)
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.middleware("http")
    async def cache_static_assets(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        file_path = os.path.realpath(os.path.join(STATIC_DIR, path))
        # Prevent path traversal — resolved path must stay inside STATIC_DIR
        if not file_path.startswith(os.path.realpath(STATIC_DIR)):
            return FileResponse(os.path.join(STATIC_DIR, "index.html"))
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
