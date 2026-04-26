import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from core.db import db
from core.models import (
    SignupRequest, LoginRequest, AuthResponse, UserResponse, TranslationUpdate,
)
from core.security import (
    hash_password, verify_password, create_access_token, serialize_user, get_current_user,
)

router = APIRouter(tags=['auth'])


@router.post('/auth/signup', response_model=AuthResponse)
async def signup(payload: SignupRequest):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({'email': email})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    user_id = str(uuid.uuid4())
    user_doc = {
        'id': user_id,
        'email': email,
        'name': payload.name or email.split('@')[0],
        'password_hash': hash_password(payload.password),
        'bible_translation': 'NIV',
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    return AuthResponse(access_token=token, user=serialize_user(user_doc))


@router.post('/auth/login', response_model=AuthResponse)
async def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    user = await db.users.find_one({'email': email})
    if not user or not verify_password(payload.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid email or password')
    token = create_access_token(user['id'], email)
    return AuthResponse(access_token=token, user=serialize_user(user))


@router.get('/auth/me', response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)


@router.patch('/settings/translation', response_model=UserResponse)
async def update_translation(
    payload: TranslationUpdate,
    current_user: dict = Depends(get_current_user),
):
    await db.users.update_one(
        {'id': current_user['id']}, {'$set': {'bible_translation': payload.translation}}
    )
    current_user['bible_translation'] = payload.translation
    return serialize_user(current_user)
