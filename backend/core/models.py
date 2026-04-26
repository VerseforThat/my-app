from typing import List, Optional, Literal
from pydantic import BaseModel, Field, EmailStr


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
    bible_translation: str = 'NIV'


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    user: UserResponse


class TranslationUpdate(BaseModel):
    translation: Literal['NIV', 'KJV']


class ProblemRequest(BaseModel):
    problem: str = Field(min_length=3, max_length=1000)


class VerseMatch(BaseModel):
    id: str
    problem: str
    reference: str
    verse_text: str
    explanation: str
    created_at: str


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


class DailyVerse(BaseModel):
    reference: str
    verse_text: str
    explanation: str
    date: str


class FavoriteCreate(BaseModel):
    match_id: str


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class TTSResponse(BaseModel):
    audio_base64: str
    mime_type: str = 'audio/mpeg'
