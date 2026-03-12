from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import HOST, PORT
from routes.worlds import router as worlds_router
from routes.simulate import router as simulate_router

app = FastAPI(title="Hermes Genesis", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(worlds_router)
app.include_router(simulate_router)

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
