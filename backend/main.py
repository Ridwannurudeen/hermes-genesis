import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from config import HOST, PORT
from routes.worlds import router as worlds_router
from routes.simulate import router as simulate_router
from routes.stream import router as stream_router
from telegram_bot import create_bot

app = FastAPI(title="Hermes Genesis", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(worlds_router)
app.include_router(simulate_router)
app.include_router(stream_router)

@app.on_event("startup")
async def startup():
    bot = create_bot()
    if bot:
        await bot.initialize()
        await bot.start()
        await bot.updater.start_polling()

@app.on_event("shutdown")
async def shutdown():
    from telegram_bot import _bot_app
    if _bot_app:
        await _bot_app.updater.stop()
        await _bot_app.stop()
        await _bot_app.shutdown()

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}

# Serve frontend static files (in production, after Docker build copies dist/ to static/)
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        file_path = os.path.join(STATIC_DIR, path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
