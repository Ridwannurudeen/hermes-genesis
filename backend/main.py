import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response
import config
from config import HOST, PORT, CORS_ORIGINS
from auth import request_is_admin
from routes.admin import router as admin_router
from routes.auth import router as auth_router
from routes.worlds import router as worlds_router
from routes.simulate import router as simulate_router
from routes.stream import router as stream_router
from routes.scenes import router as scenes_router
from chroniclon.routes import router as chronicle_router
from telegram_bot import create_bot
from llm import close_client
from rate_limit import rate_limit_middleware
from usage import usage_middleware


def _validate_production_config() -> None:
    if config.APP_ENV not in {"production", "prod"}:
        return
    missing = []
    if not config.API_KEY:
        missing.append("GENESIS_API_KEY")
    if not config.CORS_ORIGINS:
        missing.append("CORS_ORIGINS")
    if missing:
        raise RuntimeError(f"Production config missing required env vars: {', '.join(missing)}")


_validate_production_config()


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

# CORS: never wildcard. If CORS_ORIGINS is unset we fall back to safe localhost
# defaults so dev still works, but production MUST set CORS_ORIGINS explicitly.
if CORS_ORIGINS:
    _cors_origins = CORS_ORIGINS
else:
    import logging
    logging.getLogger(__name__).warning(
        "CORS_ORIGINS not set — defaulting to localhost only. Set CORS_ORIGINS "
        "in .env to your public domain(s) for production."
    )
    _cors_origins = [
        "http://localhost:5173",  # Vite dev
        "http://localhost:8003",  # bundled prod (same-origin)
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8003",
    ]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
    allow_credentials=True,
)

app.add_middleware(GZipMiddleware, minimum_size=500)


# API key/admin-session gate on mutating routes (POST/PATCH/DELETE) when GENESIS_API_KEY is set.
# Header-only — query-param keys leak into logs, browser history, proxies.
# `config.API_KEY` is read at call time (not import time) so tests can rebind it.
@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    api_key = config.API_KEY
    if (
        api_key
        and request.method in ("POST", "PATCH", "DELETE")
        and request.url.path.startswith("/api/")
        and request.url.path not in {"/api/auth/login", "/api/auth/logout"}
    ):
        if not request_is_admin(request):
            return JSONResponse(status_code=403, content={"detail": "Invalid or missing API key"})
    return await call_next(request)


# Rate limiting on LLM-calling endpoints
app.middleware("http")(rate_limit_middleware)

# Usage telemetry for grant/admin operations
app.middleware("http")(usage_middleware)


app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(worlds_router)
app.include_router(simulate_router)
app.include_router(stream_router)
app.include_router(scenes_router)
app.include_router(chronicle_router)

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0", "auth_required": bool(config.API_KEY)}


@app.get("/robots.txt", include_in_schema=False)
async def robots_txt() -> Response:
    """Allow crawlers everywhere except admin + auth surfaces."""
    body = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin\n"
        "Disallow: /api/auth/\n"
        "Disallow: /api/admin/\n"
        "\n"
        "Sitemap: https://hermesgenesis.world/sitemap.xml\n"
    )
    return Response(content=body, media_type="text/plain; charset=utf-8")


@app.get("/sitemap.xml", include_in_schema=False)
async def sitemap_xml(request: Request) -> Response:
    """Sitemap of public surfaces + every canonized article slug.
    Crawler-discoverable; signal that this is a real publication."""
    from chroniclon import store as chronicle_store

    base = str(request.base_url).rstrip("/")
    static_paths = [
        "/", "/chronicle", "/about", "/contributors",
        "/demo", "/try-it", "/control", "/judge",
    ]
    article_rows = chronicle_store.list_articles(limit=10_000)
    article_paths = [f"/chronicle/{r['slug']}" for r in article_rows]

    urls = [f"{base}{p}" for p in static_paths + article_paths]
    body_xml = "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls)
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body_xml}\n"
        "</urlset>\n"
    )
    return Response(content=xml, media_type="application/xml; charset=utf-8")

# Serve frontend static files (in production, after Docker build copies dist/ to static/)
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


def _resolve_static_file(path: str) -> str | None:
    """Return a resolved static file path only if it stays inside STATIC_DIR."""
    static_root = os.path.realpath(STATIC_DIR)
    requested = os.path.realpath(os.path.join(static_root, path))
    try:
        inside_static = os.path.commonpath([
            os.path.normcase(static_root),
            os.path.normcase(requested),
        ]) == os.path.normcase(static_root)
    except ValueError:
        inside_static = False
    return requested if inside_static else None


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
        file_path = _resolve_static_file(path)
        # Prevent path traversal — resolved path must stay inside STATIC_DIR
        if not file_path:
            return FileResponse(os.path.join(STATIC_DIR, "index.html"))
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
