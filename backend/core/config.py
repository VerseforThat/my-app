from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env', override=True)

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
ELEVENLABS_API_KEY = os.environ['ELEVENLABS_API_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = 'HS256'

# David - British Radio Host & Storyteller
DEFAULT_VOICE_ID = '5gLuKtB16QIQv1vuSas1'

# Claude model
LLM_MODEL = 'claude-sonnet-4-5-20250929'
