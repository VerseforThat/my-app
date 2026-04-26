from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import base64
import json
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage
from elevenlabs import ElevenLabs, VoiceSettings


# ---------------- Config ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
ELEVENLABS_API_KEY = os.environ['ELEVENLABS_API_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

# Pre-selected serene female voice from ElevenLabs default voices
DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"  # Sarah - calm, warm

eleven_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

app = FastAPI(title="His Word API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------------- Models ----------------
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ProblemRequest(BaseModel):
    problem: str = Field(min_length=3, max_length=1000)


class VerseMatch(BaseModel):
    id: str
    problem: str
    reference: str
    verse_text: str
    explanation: str
    created_at: str


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class TTSResponse(BaseModel):
    audio_base64: str
    mime_type: str = "audio/mpeg"


class FavoriteCreate(BaseModel):
    match_id: str


class DailyVerse(BaseModel):
    reference: str
    verse_text: str
    explanation: str
    date: str


# ---------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload["sub"]
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------- LLM helpers ----------------
SYSTEM_PROMPT = """You are a compassionate, faithful Christian companion in the "His Word" app. Your role is to listen deeply to a person sharing a struggle, fear, joy, or question — and respond with the most fitting Bible verse from the NIV (New International Version) translation.

Always respond with ONLY a valid JSON object (no markdown, no code fences) in this exact shape:
{
  "reference": "Book Chapter:Verse" (e.g. "Philippians 4:6-7"),
  "verse_text": "The full text of the verse(s) in NIV translation",
  "explanation": "A warm, empathetic 3-5 sentence reflection that gently connects the verse to their specific situation. Speak like a caring pastor or trusted friend — not a lecture. Acknowledge their feeling, then unfold the verse's meaning, then offer hope."
}

Choose verses that are deeply relevant, well-known when possible, and bring genuine comfort. Avoid prosperity-gospel platitudes. Do not include any text outside the JSON."""


async def match_verse_with_claude(problem: str, session_id: str) -> dict:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    response = await chat.send_message(UserMessage(text=problem))
    text = response.strip()
    # Strip markdown fences if any
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    data = json.loads(text)
    if not all(k in data for k in ("reference", "verse_text", "explanation")):
        raise ValueError("Invalid LLM response shape")
    return data


# ---------------- Routes: Auth ----------------
@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(payload: SignupRequest):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": payload.name or email.split("@")[0],
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    return AuthResponse(
        access_token=token,
        user=UserResponse(id=user_id, email=email, name=user_doc["name"]),
    )


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    return AuthResponse(
        access_token=token,
        user=UserResponse(id=user["id"], email=email, name=user.get("name")),
    )


@api_router.get("/auth/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)):
    return UserResponse(id=current_user["id"], email=current_user["email"], name=current_user.get("name"))


# ---------------- Routes: Verse Matching ----------------
@api_router.post("/verses/match", response_model=VerseMatch)
async def match_verse(payload: ProblemRequest, current_user: dict = Depends(get_current_user)):
    try:
        result = await match_verse_with_claude(payload.problem, session_id=f"user-{current_user['id']}")
    except Exception as e:
        logger.error(f"Verse match failed: {e}")
        raise HTTPException(status_code=500, detail="Could not match a verse right now. Please try again.")

    match_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": match_id,
        "user_id": current_user["id"],
        "problem": payload.problem,
        "reference": result["reference"],
        "verse_text": result["verse_text"],
        "explanation": result["explanation"],
        "created_at": now,
    }
    await db.verse_matches.insert_one(doc)
    return VerseMatch(
        id=match_id,
        problem=payload.problem,
        reference=result["reference"],
        verse_text=result["verse_text"],
        explanation=result["explanation"],
        created_at=now,
    )


@api_router.get("/history", response_model=List[VerseMatch])
async def get_history(current_user: dict = Depends(get_current_user)):
    cursor = db.verse_matches.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "user_id": 0},
    ).sort("created_at", -1).limit(100)
    items = await cursor.to_list(length=100)
    return [VerseMatch(**i) for i in items]


# ---------------- Routes: Favorites ----------------
@api_router.post("/favorites", response_model=VerseMatch)
async def add_favorite(payload: FavoriteCreate, current_user: dict = Depends(get_current_user)):
    match = await db.verse_matches.find_one(
        {"id": payload.match_id, "user_id": current_user["id"]},
        {"_id": 0, "user_id": 0},
    )
    if not match:
        raise HTTPException(status_code=404, detail="Verse not found")
    existing = await db.favorites.find_one({"user_id": current_user["id"], "match_id": payload.match_id})
    if not existing:
        await db.favorites.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "match_id": payload.match_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    return VerseMatch(**match)


@api_router.get("/favorites", response_model=List[VerseMatch])
async def list_favorites(current_user: dict = Depends(get_current_user)):
    favs = await db.favorites.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    match_ids = [f["match_id"] for f in favs]
    if not match_ids:
        return []
    cursor = db.verse_matches.find(
        {"id": {"$in": match_ids}, "user_id": current_user["id"]},
        {"_id": 0, "user_id": 0},
    )
    items = await cursor.to_list(length=200)
    # Preserve favorite order
    by_id = {i["id"]: i for i in items}
    ordered = [by_id[m] for m in match_ids if m in by_id]
    return [VerseMatch(**i) for i in ordered]


@api_router.delete("/favorites/{match_id}")
async def remove_favorite(match_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.favorites.delete_one({"user_id": current_user["id"], "match_id": match_id})
    return {"deleted": result.deleted_count}


# ---------------- Routes: TTS ----------------
@api_router.post("/tts/generate", response_model=TTSResponse)
async def generate_tts(payload: TTSRequest, current_user: dict = Depends(get_current_user)):
    try:
        audio_iter = eleven_client.text_to_speech.convert(
            text=payload.text,
            voice_id=DEFAULT_VOICE_ID,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
            voice_settings=VoiceSettings(
                stability=0.6,
                similarity_boost=0.75,
                style=0.2,
                use_speaker_boost=True,
            ),
        )
        audio_bytes = b"".join(audio_iter)
        b64 = base64.b64encode(audio_bytes).decode("utf-8")
        return TTSResponse(audio_base64=b64, mime_type="audio/mpeg")
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        raise HTTPException(status_code=500, detail="Voice generation failed")


# ---------------- Routes: Daily Verse ----------------
DAILY_VERSE_PROMPT = """Pick ONE inspiring, uplifting Bible verse from the NIV translation suitable as today's daily devotional verse. Return ONLY a valid JSON object (no markdown):
{
  "reference": "Book Chapter:Verse",
  "verse_text": "The verse in NIV translation",
  "explanation": "A 2-3 sentence warm devotional reflection on this verse for today."
}"""


@api_router.get("/daily-verse", response_model=DailyVerse)
async def daily_verse():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cached = await db.daily_verses.find_one({"date": today}, {"_id": 0})
    if cached:
        return DailyVerse(**cached)
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"daily-{today}",
            system_message=DAILY_VERSE_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        response = await chat.send_message(UserMessage(text=f"Today is {today}. Give me today's verse."))
        text = response.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
        data = json.loads(text)
        doc = {
            "date": today,
            "reference": data["reference"],
            "verse_text": data["verse_text"],
            "explanation": data["explanation"],
        }
        await db.daily_verses.insert_one(doc.copy())
        return DailyVerse(**doc)
    except Exception as e:
        logger.error(f"Daily verse failed: {e}")
        # Fallback verse
        fallback = {
            "date": today,
            "reference": "Jeremiah 29:11",
            "verse_text": "\"For I know the plans I have for you,\" declares the Lord, \"plans to prosper you and not to harm you, plans to give you hope and a future.\"",
            "explanation": "Today, rest in the truth that God's plans for you are full of hope. Whatever uncertainty you face, He goes before you with intention and care.",
        }
        return DailyVerse(**fallback)


# ---------------- Health ----------------
@api_router.get("/")
async def root():
    return {"message": "His Word API", "status": "ok"}


# ---------------- Startup / shutdown ----------------
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.verse_matches.create_index([("user_id", 1), ("created_at", -1)])
    await db.favorites.create_index([("user_id", 1), ("match_id", 1)], unique=True)
    await db.daily_verses.create_index("date", unique=True)
    logger.info("MongoDB indexes ready")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ---------------- App wiring ----------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
