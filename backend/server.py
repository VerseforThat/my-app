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

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage
from elevenlabs import ElevenLabs, VoiceSettings
import stripe
import asyncio


mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']
ELEVENLABS_API_KEY = os.environ['ELEVENLABS_API_KEY']
JWT_SECRET = os.environ['JWT_SECRET']
STRIPE_API_KEY = os.environ['STRIPE_API_KEY']
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
JWT_ALGORITHM = "HS256"

stripe.api_key = STRIPE_API_KEY

# David - British Radio Host & Storyteller
DEFAULT_VOICE_ID = "5gLuKtB16QIQv1vuSas1"

# Subscription product (Stripe handles auto-renewal natively)
SUBSCRIPTION_PRICE_USD = 4.99
SUBSCRIPTION_PRICE_CENTS = 499
TRIAL_DAYS = 7
FREE_VERSES_LIFETIME = 3
PRODUCT_NAME = "His Word Premium"
PRICE_LOOKUP_KEY = "his_word_premium_monthly_499"

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
    bible_translation: str = "NIV"
    verses_used: int = 0
    free_verses_remaining: int = 0
    subscription_status: str = "free"  # free, trialing, active, expired
    is_premium: bool = False
    current_period_end: Optional[str] = None


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


class CheckoutRequest(BaseModel):
    origin_url: str


class VerseContext(BaseModel):
    reference: str
    context_text: str


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


def is_user_premium(user: dict) -> bool:
    """Check if user's subscription is currently active (trial or paid)."""
    status = user.get("subscription_status", "free")
    if status not in ("trialing", "active"):
        return False
    end = user.get("current_period_end")
    if not end:
        return False
    try:
        end_dt = datetime.fromisoformat(end)
        return end_dt > datetime.now(timezone.utc)
    except Exception:
        return False


def serialize_user(user: dict) -> UserResponse:
    is_prem = is_user_premium(user)
    used = int(user.get("verses_used", 0))
    free_remaining = max(0, FREE_VERSES_LIFETIME - used) if not is_prem else 0
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
        bible_translation=user.get("bible_translation", "NIV"),
        verses_used=used,
        free_verses_remaining=free_remaining,
        subscription_status=user.get("subscription_status", "free"),
        is_premium=is_prem,
        current_period_end=user.get("current_period_end"),
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
def system_prompt_for(translation: str) -> str:
    return f"""You are a compassionate, faithful Christian companion in the "His Word" app. Your role is to listen deeply to a person sharing a struggle, fear, joy, or question — and respond with the most fitting Bible verse from the {translation} translation.

Always respond with ONLY a valid JSON object (no markdown, no code fences) in this exact shape:
{{
  "reference": "Book Chapter:Verse" (e.g. "Philippians 4:6-7"),
  "verse_text": "The full text of the verse(s) in {translation} translation",
  "explanation": "A warm, empathetic 3-5 sentence reflection that gently connects the verse to their specific situation. Speak like a caring pastor or trusted friend — not a lecture. Acknowledge their feeling, then unfold the verse's meaning, then offer hope."
}}

Choose verses that are deeply relevant, well-known when possible, and bring genuine comfort. Avoid prosperity-gospel platitudes. Do not include any text outside the JSON."""


def context_prompt_for(translation: str, reference: str) -> str:
    return f"""Provide the surrounding biblical context for {reference} in the {translation} translation.

Return ONLY a valid JSON object (no markdown, no code fences):
{{
  "reference": "Book Chapter:Verse-Verse" (the wider passage you're returning, e.g. 3-5 verses before AND after the original),
  "context_text": "The full passage text in {translation} translation, with verse numbers in [brackets] before each verse, separated by spaces."
}}

Include 3-5 verses before and after the original verse so the reader sees the full passage. Stay strictly within the passage; do not add commentary."""


def strip_json_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return text


async def match_verse_with_claude(problem: str, translation: str, session_id: str) -> dict:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_prompt_for(translation),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    response = await chat.send_message(UserMessage(text=problem))
    data = json.loads(strip_json_fences(response))
    if not all(k in data for k in ("reference", "verse_text", "explanation")):
        raise ValueError("Invalid LLM response shape")
    return data


async def fetch_context_with_claude(reference: str, translation: str, session_id: str) -> dict:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=context_prompt_for(translation, reference),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    response = await chat.send_message(UserMessage(text=f"Give me the surrounding context for {reference}."))
    data = json.loads(strip_json_fences(response))
    if not all(k in data for k in ("reference", "context_text")):
        raise ValueError("Invalid context response")
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
        "bible_translation": "NIV",
        "verses_used": 0,
        "subscription_status": "free",
        "stripe_customer_id": None,
        "current_period_end": None,
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
    # Quota check
    if not is_user_premium(current_user):
        used = int(current_user.get("verses_used", 0))
        if used >= FREE_VERSES_LIFETIME:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "free_limit_reached",
                    "message": f"You've used all {FREE_VERSES_LIFETIME} free verses. Start your 7-day free trial to continue.",
                    "verses_used": used,
                    "free_verses_total": FREE_VERSES_LIFETIME,
                },
            )

    translation = current_user.get("bible_translation", "NIV")
    try:
        result = await match_verse_with_claude(
            payload.problem, translation, session_id=f"user-{current_user['id']}"
        )
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

    # Increment usage counter
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"verses_used": 1}})

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
    if not is_user_premium(current_user):
        raise HTTPException(
            status_code=402,
            detail={"error": "premium_required", "message": "Read more context is a premium feature."},
        )
    match = await db.verse_matches.find_one(
        {"id": match_id, "user_id": current_user["id"]}, {"_id": 0}
    )
    if not match:
        raise HTTPException(status_code=404, detail="Verse not found")

    translation = match.get("translation") or current_user.get("bible_translation", "NIV")
    try:
        result = await fetch_context_with_claude(
            match["reference"], translation, session_id=f"context-{current_user['id']}"
        )
    except Exception as e:
        logger.error(f"Context fetch failed: {e}")
        raise HTTPException(status_code=500, detail="Could not load context right now.")
    return VerseContext(**result)


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
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"daily-{today}",
            system_message=DAILY_VERSE_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        response = await chat.send_message(UserMessage(text=f"Today is {today}. Give me today's verse."))
        data = json.loads(strip_json_fences(response))
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


# ---------------- Routes: Subscription (Stripe native auto-renewing) ----------------
async def _ensure_stripe_price() -> str:
    """Idempotently ensure the $4.99/mo recurring price exists; return its id."""
    cfg = await db.stripe_config.find_one({"key": "subscription_price"}, {"_id": 0})
    if cfg and cfg.get("price_id"):
        return cfg["price_id"]
    # Try lookup_key first
    existing = await asyncio.to_thread(
        lambda: stripe.Price.list(lookup_keys=[PRICE_LOOKUP_KEY], active=True, limit=1)
    )
    if existing.data:
        price_id = existing.data[0].id
    else:
        # Create product + price
        product = await asyncio.to_thread(
            lambda: stripe.Product.create(name=PRODUCT_NAME, description="Unlimited Bible verse matches, voice, context.")
        )
        price = await asyncio.to_thread(
            lambda: stripe.Price.create(
                product=product.id,
                unit_amount=SUBSCRIPTION_PRICE_CENTS,
                currency="usd",
                recurring={"interval": "month"},
                lookup_key=PRICE_LOOKUP_KEY,
            )
        )
        price_id = price.id
    await db.stripe_config.update_one(
        {"key": "subscription_price"},
        {"$set": {"price_id": price_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    logger.info(f"Stripe price ready: {price_id}")
    return price_id


async def _get_or_create_customer(user: dict) -> str:
    if user.get("stripe_customer_id"):
        return user["stripe_customer_id"]
    customer = await asyncio.to_thread(
        lambda: stripe.Customer.create(email=user["email"], name=user.get("name") or None, metadata={"user_id": user["id"]})
    )
    await db.users.update_one({"id": user["id"]}, {"$set": {"stripe_customer_id": customer.id}})
    return customer.id


async def _apply_subscription_to_user(user_id: str, sub: dict) -> None:
    """Mirror Stripe subscription state onto our user document."""
    status = sub.get("status", "free")  # trialing, active, past_due, canceled, unpaid, incomplete
    cpe_ts = sub.get("current_period_end")
    cpe_iso = datetime.fromtimestamp(cpe_ts, tz=timezone.utc).isoformat() if cpe_ts else None
    update = {
        "subscription_status": status,
        "stripe_subscription_id": sub.get("id"),
        "current_period_end": cpe_iso,
        "cancel_at_period_end": bool(sub.get("cancel_at_period_end", False)),
    }
    await db.users.update_one({"id": user_id}, {"$set": update})


@api_router.post("/subscription/checkout")
async def create_subscription_checkout(
    payload: CheckoutRequest, http_request: Request, current_user: dict = Depends(get_current_user)
):
    if is_user_premium(current_user) and current_user.get("subscription_status") in ("trialing", "active"):
        raise HTTPException(status_code=400, detail="You already have an active subscription.")

    price_id = await _ensure_stripe_price()
    customer_id = await _get_or_create_customer(current_user)

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/subscription/cancel"

    # Only first-time users get the 7-day free trial
    is_first_payment = not current_user.get("first_payment_done", False)
    subscription_data = {"metadata": {"user_id": current_user["id"]}}
    if is_first_payment:
        subscription_data["trial_period_days"] = TRIAL_DAYS

    try:
        session = await asyncio.to_thread(
            lambda: stripe.checkout.Session.create(
                mode="subscription",
                customer=customer_id,
                line_items=[{"price": price_id, "quantity": 1}],
                success_url=success_url,
                cancel_url=cancel_url,
                subscription_data=subscription_data,
                allow_promotion_codes=True,
                metadata={"user_id": current_user["id"]},
            )
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe checkout failed: {e}")
        raise HTTPException(status_code=502, detail=str(e.user_message or "Stripe error"))

    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.id,
        "user_id": current_user["id"],
        "email": current_user["email"],
        "amount": SUBSCRIPTION_PRICE_USD,
        "currency": "usd",
        "metadata": {"plan": "monthly_4_99", "trial_days": TRIAL_DAYS if is_first_payment else 0},
        "payment_status": "pending",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"url": session.url, "session_id": session.id, "trial_days": TRIAL_DAYS if is_first_payment else 0}


@api_router.get("/subscription/status/{session_id}")
async def check_subscription_status(session_id: str, current_user: dict = Depends(get_current_user)):
    txn = await db.payment_transactions.find_one(
        {"session_id": session_id, "user_id": current_user["id"]}, {"_id": 0}
    )
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    try:
        session = await asyncio.to_thread(
            lambda: stripe.checkout.Session.retrieve(session_id, expand=["subscription"])
        )
    except stripe.error.StripeError as e:
        logger.warning(f"Stripe session lookup failed for {session_id}: {e}")
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
        return {
            "payment_status": txn.get("payment_status", "pending"),
            "status": txn.get("status", "pending"),
            "user": serialize_user(user).dict(),
        }

    payment_status = session.payment_status  # paid, unpaid, no_payment_required
    status = session.status  # complete, expired, open
    sub = session.subscription if hasattr(session, "subscription") and session.subscription else None

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": payment_status, "status": status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    if sub and isinstance(sub, dict) is False:
        sub = sub.to_dict() if hasattr(sub, "to_dict") else dict(sub)

    if sub and not current_user.get("first_payment_done") and (sub.get("status") in ("trialing", "active")):
        await db.users.update_one({"id": current_user["id"]}, {"$set": {"first_payment_done": True}})

    if sub:
        await _apply_subscription_to_user(current_user["id"], sub)

    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    return {"payment_status": payment_status, "status": status, "user": serialize_user(user).dict()}


@api_router.post("/subscription/portal")
async def create_billing_portal(payload: CheckoutRequest, current_user: dict = Depends(get_current_user)):
    customer_id = current_user.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No subscription found")
    return_url = payload.origin_url.rstrip("/") + "/(tabs)/settings"
    try:
        portal = await asyncio.to_thread(
            lambda: stripe.billing_portal.Session.create(customer=customer_id, return_url=return_url)
        )
    except stripe.error.StripeError as e:
        logger.error(f"Portal create failed: {e}")
        raise HTTPException(status_code=502, detail=str(e.user_message or "Stripe error"))
    return {"url": portal.url}


@api_router.post("/subscription/start-trial", response_model=UserResponse)
async def start_trial(current_user: dict = Depends(get_current_user)):
    raise HTTPException(
        status_code=400,
        detail="Card-free trial is no longer available. Add a card via the subscribe button to start your 7-day free trial.",
    )


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    # Verify signature if secret configured
    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(body, signature, STRIPE_WEBHOOK_SECRET)
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            logger.warning(f"Webhook signature verification failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # No secret configured — parse raw event (dev only)
        try:
            event = stripe.Event.construct_from(json.loads(body.decode("utf-8")), stripe.api_key)
        except Exception as e:
            logger.warning(f"Webhook parse failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid payload")

    event_type = event["type"]
    raw_obj = event["data"]["object"]
    # Deep-convert StripeObject to plain dict so chained .get works on nested fields
    try:
        obj = json.loads(json.dumps(raw_obj, default=str))
    except Exception:
        obj = dict(raw_obj) if hasattr(raw_obj, "keys") else {}
    logger.info(f"Stripe webhook: {event_type}")

    try:
        if event_type == "checkout.session.completed":
            user_id = (obj.get("metadata") or {}).get("user_id")
            sub_id = obj.get("subscription")
            if user_id and sub_id:
                sub_obj = await asyncio.to_thread(lambda: stripe.Subscription.retrieve(sub_id))
                sub_dict = json.loads(json.dumps(sub_obj, default=str))
                await _apply_subscription_to_user(user_id, sub_dict)
                await db.users.update_one({"id": user_id}, {"$set": {"first_payment_done": True}})

        elif event_type in ("customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"):
            user_id = (obj.get("metadata") or {}).get("user_id")
            if not user_id:
                cust_id = obj.get("customer")
                if cust_id:
                    user = await db.users.find_one({"stripe_customer_id": cust_id}, {"_id": 0, "id": 1})
                    user_id = user["id"] if user else None
            if user_id:
                if event_type == "customer.subscription.deleted":
                    obj["status"] = "canceled"
                await _apply_subscription_to_user(user_id, obj)

        elif event_type == "invoice.payment_failed":
            cust_id = obj.get("customer")
            if cust_id:
                user = await db.users.find_one({"stripe_customer_id": cust_id}, {"_id": 0, "id": 1})
                if user:
                    await db.users.update_one({"id": user["id"]}, {"$set": {"subscription_status": "past_due"}})

        elif event_type == "invoice.paid":
            cust_id = obj.get("customer")
            sub_id = obj.get("subscription")
            if sub_id:
                sub_obj = await asyncio.to_thread(lambda: stripe.Subscription.retrieve(sub_id))
                sub_dict = json.loads(json.dumps(sub_obj, default=str))
                user_id = (sub_dict.get("metadata") or {}).get("user_id")
                if not user_id and cust_id:
                    user = await db.users.find_one({"stripe_customer_id": cust_id}, {"_id": 0, "id": 1})
                    user_id = user["id"] if user else None
                if user_id:
                    await _apply_subscription_to_user(user_id, sub_dict)
    except Exception as e:
        logger.error(f"Webhook handler error: {e}", exc_info=True)

    return {"received": True}




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
    await db.payment_transactions.create_index("session_id", unique=True)
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
