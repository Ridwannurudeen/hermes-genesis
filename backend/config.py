import os
from dotenv import load_dotenv

load_dotenv()

NOUS_API_KEY = os.getenv("NOUS_API_KEY", "")
NOUS_BASE_URL = os.getenv("NOUS_BASE_URL", "https://inference-api.nousresearch.com/v1")
NOUS_MODEL = os.getenv("NOUS_MODEL", "Hermes-4-70B")
DATA_DIR = os.getenv("DATA_DIR", "data/worlds")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8003"))
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
API_KEY = os.getenv("GENESIS_API_KEY", "")
CORS_ORIGINS = [x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") if x.strip()]
MAX_WORLDS = int(os.getenv("MAX_WORLDS", "20"))
IMAGE_API_KEY = os.getenv("IMAGE_API_KEY", "")
IMAGE_API_URL = os.getenv("IMAGE_API_URL", "https://api.together.xyz/v1")
IMAGE_MODEL = os.getenv("IMAGE_MODEL", "black-forest-labs/FLUX.1-schnell")
