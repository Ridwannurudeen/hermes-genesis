import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

NOUS_API_KEY = os.getenv("NOUS_API_KEY", "")
NOUS_BASE_URL = os.getenv("NOUS_BASE_URL", "https://inference-api.nousresearch.com/v1")
NOUS_MODEL = os.getenv("NOUS_MODEL", "Hermes-4-70B")
KIMI_API_KEY = os.getenv("KIMI_API_KEY", "")
KIMI_BASE_URL = os.getenv("KIMI_BASE_URL", "https://api.moonshot.ai/v1")
KIMI_MODEL = os.getenv("KIMI_MODEL", "kimi-k2.6")
DATA_DIR = os.getenv("DATA_DIR", "data/worlds")
CHRONICLON_DIR = os.getenv("CHRONICLON_DIR", "data/chroniclon")
HOST = os.getenv("HOST", "0.0.0.0")
try:
    PORT = int(os.getenv("PORT", "8003"))
except ValueError:
    PORT = 8003
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
API_KEY = os.getenv("GENESIS_API_KEY", "")
CORS_ORIGINS = [x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") if x.strip()]
try:
    MAX_WORLDS = int(os.getenv("MAX_WORLDS", "100"))
except ValueError:
    MAX_WORLDS = 100
IMAGE_API_KEY = os.getenv("IMAGE_API_KEY", "")
IMAGE_API_URL = os.getenv("IMAGE_API_URL", "https://api.together.xyz/v1")
IMAGE_MODEL = os.getenv("IMAGE_MODEL", "black-forest-labs/FLUX.1-schnell")

if not NOUS_API_KEY:
    logger.warning("NOUS_API_KEY is not set — world generation will fail")
if not KIMI_API_KEY:
    logger.warning("KIMI_API_KEY is not set — chroniclon long-form generation will fall back to Nous")
