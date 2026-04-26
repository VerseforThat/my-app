from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env', override=True)

import os
import logging
import uuid
import base64
import json
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage
from elevenlabs import ElevenLabs, VoiceSettings


mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
ELEVENLABS_API_KEY = os.environ['ELEVENLABS_API_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

# David - British Radio Host & Storyteller
DEFAULT_VOICE_ID = "5gLuKtB16QIQv1vuSas1"

eleven_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

app = FastAPI(title="Verse for That API")
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
    bible_translation: str = "NIV"


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


class TranslationUpdate(BaseModel):
    translation: Literal["NIV", "KJV"]


class VerseContext(BaseModel):
    reference: str
    context_text: str


class DeeperExplanation(BaseModel):
    reference: str
    explanation: str


class RelatedVerseItem(BaseModel):
    reference: str
    verse_text: str
    note: str


class RelatedVerses(BaseModel):
    items: List[RelatedVerseItem]


class VerseSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)


class VerseSearchItem(BaseModel):
    reference: str
    verse_text: str
    note: str


class VerseSearchResponse(BaseModel):
    query: str
    items: List[VerseSearchItem]


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


def serialize_user(user: dict) -> UserResponse:
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
        bible_translation=user.get("bible_translation", "NIV"),
    )


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
def strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return text


async def _claude_json(system_message: str, user_text: str, session_id: str) -> dict:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    response = await chat.send_message(UserMessage(text=user_text))
    return json.loads(strip_json_fences(response))


def system_prompt_for(translation: str, avoid_refs: List[str]) -> str:
    avoid_block = ""
    if avoid_refs:
        joined = ", ".join(avoid_refs[:10])
        avoid_block = f"\n\nIMPORTANT: The reader has recently been shown these verses — DO NOT pick any of them again, choose a fresh, different passage even if the underlying struggle is similar:\n{joined}"

    return f"""You are a compassionate, faithful Christian companion in the "Verse for That" app. Your role is to listen deeply to a person sharing a struggle, fear, joy, or question — and respond with the most fitting Bible verse from the {translation} translation.

Always respond with ONLY a valid JSON object (no markdown, no code fences) in this exact shape:
{{
  "reference": "Book Chapter:Verse" (e.g. "Philippians 4:6-7"),
  "verse_text": "The full text of the verse(s) in {translation} translation",
  "explanation": "A warm, empathetic 3-5 sentence reflection that gently connects the verse to their specific situation. Speak like a caring pastor or trusted friend — not a lecture. Acknowledge their feeling, then unfold the verse's meaning, then offer hope."
}}

Choose verses that are deeply relevant. Vary your selections — the Bible is rich; rotate across the Old and New Testaments, the Psalms, the Gospels, the Epistles. Avoid prosperity-gospel platitudes. Do not include any text outside the JSON.{avoid_block}"""


def context_prompt_for(translation: str, reference: str) -> str:
    return f"""Provide the surrounding biblical context for {reference} in the {translation} translation.

Return ONLY a valid JSON object (no markdown, no code fences):
{{
  "reference": "Book Chapter:Verse-Verse" (the wider passage, 3-5 verses before AND after the original),
  "context_text": "The full passage text in {translation} translation, with verse numbers in [brackets] before each verse, separated by spaces."
}}

Stay strictly within the passage; do not add commentary."""


def deeper_prompt_for(translation: str, reference: str, verse_text: str, problem: str) -> str:
    return f"""Provide a deeper, richer explanation of {reference} ({translation}) for someone wrestling with: "{problem}".

The verse text is:
"{verse_text}"

Return ONLY a valid JSON object (no markdown, no code fences):
{{
  "reference": "{reference}",
  "explanation": "A thoughtful 6-9 sentence pastoral reflection. Cover: (1) the historical / literary context briefly, (2) the original meaning the author intended, (3) how Christians have traditionally read it, (4) what it specifically means for someone facing the user's struggle today, and (5) a gentle, practical application. Warm, never preachy."
}}"""


def related_prompt_for(translation: str, reference: str, problem: str) -> str:
    return f"""Suggest 4 OTHER Bible verses ({translation} translation) that connect thematically with {reference}, and which would also encourage someone navigating: "{problem}".

Do NOT include {reference} itself. Vary across Old and New Testament where possible.

Return ONLY a valid JSON object (no markdown, no code fences):
{{
  "items": [
    {{ "reference": "Book Chapter:Verse", "verse_text": "Full verse text in {translation}", "note": "One short sentence on how it connects." }},
    ...four items total
  ]
}}"""


def search_prompt_for(translation: str) -> str:
    return f"""You are a Bible search assistant for the "Verse for That" app, working with the {translation} translation.

The user will type either:
- A direct verse reference (e.g. "John 3:16", "Psalm 23", "Romans 8:28-30"), or
- A keyword / theme / phrase (e.g. "love", "anxiety", "the lord is my shepherd").

If it's a direct reference, return that exact verse / passage.
If it's a keyword or theme, return up to 5 of the most relevant well-known verses on that topic.

Return ONLY a valid JSON object (no markdown, no code fences):
{{
  "items": [
    {{ "reference": "Book Chapter:Verse", "verse_text": "Full verse text in {translation}", "note": "One short sentence of context or why it matches." }}
  ]
}}

Always include at least one item. If the input is unclear, do your best to interpret it as a topic."""


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
        "bible_translation": "NIV",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    return AuthResponse(access_token=token, user=serialize_user(user_doc))


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    return AuthResponse(access_token=token, user=serialize_user(user))


@api_router.get("/auth/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)


# ---------------- Routes: Settings ----------------
@api_router.patch("/settings/translation", response_model=UserResponse)
async def update_translation(payload: TranslationUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]}, {"$set": {"bible_translation": payload.translation}}
    )
    current_user["bible_translation"] = payload.translation
    return serialize_user(current_user)


# ---------------- Routes: Verse Matching ----------------
@api_router.post("/verses/match", response_model=VerseMatch)
async def match_verse(payload: ProblemRequest, current_user: dict = Depends(get_current_user)):
    translation = current_user.get("bible_translation", "NIV")

    # Pull last 10 references this user has already seen so the LLM can avoid repeats
    recent = await db.verse_matches.find(
        {"user_id": current_user["id"]}, {"_id": 0, "reference": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    avoid_refs = [r["reference"] for r in recent if r.get("reference")]

    # Salt the session id with a uuid so each call is independent / non-cached
    session_id = f"match-{current_user['id']}-{uuid.uuid4()}"

    try:
        result = await _claude_json(
            system_prompt_for(translation, avoid_refs),
            payload.problem,
            session_id=session_id,
        )
        if not all(k in result for k in ("reference", "verse_text", "explanation")):
            raise ValueError("Invalid LLM response shape")
    except Exception as e:
        logger.error(f"Verse match failed: {e}")
        raise HTTPException(status_code=500, detail="Could not match a verse right now. Please try again.")

    match_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": match_id,
        "user_id": current_user["id"],
        "translation": translation,
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


@api_router.get("/verses/{match_id}/context", response_model=VerseContext)
async def get_verse_context(match_id: str, current_user: dict = Depends(get_current_user)):
    match = await db.verse_matches.find_one(
        {"id": match_id, "user_id": current_user["id"]}, {"_id": 0}
    )
    if not match:
        raise HTTPException(status_code=404, detail="Verse not found")

    translation = match.get("translation") or current_user.get("bible_translation", "NIV")
    try:
        result = await _claude_json(
            context_prompt_for(translation, match["reference"]),
            f"Give me the surrounding context for {match['reference']}.",
            session_id=f"context-{current_user['id']}-{match_id}",
        )
        if not all(k in result for k in ("reference", "context_text")):
            raise ValueError("Invalid context response")
    except Exception as e:
        logger.error(f"Context fetch failed: {e}")
        raise HTTPException(status_code=500, detail="Could not load context right now.")
    return VerseContext(**result)


@api_router.get("/verses/{match_id}/explanation", response_model=DeeperExplanation)
async def get_deeper_explanation(match_id: str, current_user: dict = Depends(get_current_user)):
    match = await db.verse_matches.find_one(
        {"id": match_id, "user_id": current_user["id"]}, {"_id": 0}
    )
    if not match:
        raise HTTPException(status_code=404, detail="Verse not found")

    translation = match.get("translation") or current_user.get("bible_translation", "NIV")
    try:
        result = await _claude_json(
            deeper_prompt_for(translation, match["reference"], match["verse_text"], match.get("problem", "")),
            f"Explain {match['reference']} more deeply.",
            session_id=f"deeper-{current_user['id']}-{match_id}",
        )
        if not all(k in result for k in ("reference", "explanation")):
            raise ValueError("Invalid deeper-explanation response")
    except Exception as e:
        logger.error(f"Deeper explanation failed: {e}")
        raise HTTPException(status_code=500, detail="Could not load a deeper explanation right now.")
    return DeeperExplanation(**result)


@api_router.get("/verses/{match_id}/related", response_model=RelatedVerses)
async def get_related_verses(match_id: str, current_user: dict = Depends(get_current_user)):
    match = await db.verse_matches.find_one(
        {"id": match_id, "user_id": current_user["id"]}, {"_id": 0}
    )
    if not match:
        raise HTTPException(status_code=404, detail="Verse not found")

    translation = match.get("translation") or current_user.get("bible_translation", "NIV")
    try:
        result = await _claude_json(
            related_prompt_for(translation, match["reference"], match.get("problem", "")),
            f"Give me other verses related to {match['reference']}.",
            session_id=f"related-{current_user['id']}-{match_id}-{uuid.uuid4()}",
        )
        items = result.get("items") or []
        cleaned: List[RelatedVerseItem] = []
        for it in items:
            if all(k in it for k in ("reference", "verse_text", "note")):
                cleaned.append(RelatedVerseItem(**it))
        if not cleaned:
            raise ValueError("No related items returned")
    except Exception as e:
        logger.error(f"Related verses failed: {e}")
        raise HTTPException(status_code=500, detail="Could not load related verses right now.")
    return RelatedVerses(items=cleaned)


@api_router.post("/verses/search", response_model=VerseSearchResponse)
async def search_verses(payload: VerseSearchRequest, current_user: dict = Depends(get_current_user)):
    translation = current_user.get("bible_translation", "NIV")
    query = payload.query.strip()
    try:
        result = await _claude_json(
            search_prompt_for(translation),
            query,
            session_id=f"search-{current_user['id']}-{uuid.uuid4()}",
        )
        items = result.get("items") or []
        cleaned: List[VerseSearchItem] = []
        for it in items:
            if all(k in it for k in ("reference", "verse_text", "note")):
                cleaned.append(VerseSearchItem(**it))
        if not cleaned:
            raise ValueError("Empty result")
    except Exception as e:
        logger.error(f"Verse search failed: {e}")
        raise HTTPException(status_code=500, detail="Could not search the Bible right now. Please try again.")
    return VerseSearchResponse(query=query, items=cleaned)


@api_router.get("/history", response_model=List[VerseMatch])
async def get_history(current_user: dict = Depends(get_current_user)):
    cursor = db.verse_matches.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "user_id": 0, "translation": 0},
    ).sort("created_at", -1).limit(100)
    items = await cursor.to_list(length=100)
    return [VerseMatch(**i) for i in items]


# ---------------- Routes: Favorites ----------------
@api_router.post("/favorites", response_model=VerseMatch)
async def add_favorite(payload: FavoriteCreate, current_user: dict = Depends(get_current_user)):
    match = await db.verse_matches.find_one(
        {"id": payload.match_id, "user_id": current_user["id"]},
        {"_id": 0, "user_id": 0, "translation": 0},
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
        {"_id": 0, "user_id": 0, "translation": 0},
    )
    items = await cursor.to_list(length=200)
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
                stability=0.6, similarity_boost=0.75, style=0.2, use_speaker_boost=True,
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
        data = await _claude_json(
            DAILY_VERSE_PROMPT,
            f"Today is {today}. Give me today's verse.",
            session_id=f"daily-{today}",
        )
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
    return {"message": "Verse for That API", "status": "ok"}


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
