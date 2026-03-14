"""Scene image generation endpoint for cinematic mode."""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from image_gen import generate_scene_image, get_cached_image
from config import IMAGE_API_KEY

router = APIRouter(prefix="/api", tags=["scenes"])


class SceneRequest(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=300)


class SceneResponse(BaseModel):
    image: str | None = None
    cached: bool = False
    enabled: bool = True


@router.post("/scene-image")
async def generate_scene(req: SceneRequest) -> SceneResponse:
    """Generate a cinematic scene image for an event."""
    if not IMAGE_API_KEY:
        return SceneResponse(enabled=False)

    # Check cache first (instant response)
    cached = get_cached_image(req.event_type, req.title)
    if cached:
        return SceneResponse(image=cached, cached=True)

    # Generate new image
    image = await generate_scene_image(req.event_type, req.title)
    return SceneResponse(image=image, cached=False)


@router.get("/scene-image/status")
async def scene_status():
    """Check if scene image generation is available."""
    return {"enabled": bool(IMAGE_API_KEY)}
