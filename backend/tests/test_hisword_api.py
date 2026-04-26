"""His Word backend API tests - exercises auth, verse matching, history, favorites, TTS, daily verse."""
import os
import time
import uuid
import base64
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://verse-match-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

@pytest.fixture(scope="module")
def fresh_user(session):
    email = f"test_{uuid.uuid4().hex[:10]}@hisword.com"
    password = "faith1234"
    r = session.post(f"{API}/auth/signup", json={"email": email, "password": password, "name": "TestUser"})
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "password": password, "token": data["access_token"], "user": data["user"]}

@pytest.fixture(scope="module")
def auth_headers(fresh_user):
    return {"Authorization": f"Bearer {fresh_user['token']}", "Content-Type": "application/json"}


# ---------------- Health ----------------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        body = r.json()
        assert body.get("status") == "ok"


# ---------------- Auth ----------------
class TestAuth:
    def test_signup_returns_token_and_user(self, fresh_user):
        assert fresh_user["token"]
        assert fresh_user["user"]["email"] == fresh_user["email"]
        assert fresh_user["user"]["id"]

    def test_signup_duplicate_email(self, session, fresh_user):
        r = session.post(f"{API}/auth/signup", json={
            "email": fresh_user["email"], "password": "another123"
        })
        assert r.status_code == 400

    def test_login_success(self, session, fresh_user):
        r = session.post(f"{API}/auth/login", json={
            "email": fresh_user["email"], "password": fresh_user["password"]
        })
        assert r.status_code == 200
        data = r.json()
        assert data["access_token"]
        assert data["user"]["email"] == fresh_user["email"]

    def test_login_wrong_password(self, session, fresh_user):
        r = session.post(f"{API}/auth/login", json={
            "email": fresh_user["email"], "password": "wrong-pass"
        })
        assert r.status_code == 401

    def test_me_with_token(self, session, auth_headers, fresh_user):
        r = session.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == fresh_user["email"]

    def test_me_without_token(self, session):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_seed_user_login(self, session):
        # ensure test@hisword.com / faith123 exists (create if not)
        r = session.post(f"{API}/auth/login", json={"email": "test@hisword.com", "password": "faith123"})
        if r.status_code == 401:
            session.post(f"{API}/auth/signup", json={"email": "test@hisword.com", "password": "faith123", "name": "Tester"})
            r = session.post(f"{API}/auth/login", json={"email": "test@hisword.com", "password": "faith123"})
        assert r.status_code == 200, f"seed user login failed: {r.text}"


# ---------------- Daily Verse (no auth) ----------------
class TestDailyVerse:
    def test_daily_verse_public(self, session):
        r = session.get(f"{API}/daily-verse", timeout=60)
        assert r.status_code == 200
        d = r.json()
        for k in ("reference", "verse_text", "explanation", "date"):
            assert k in d and d[k]


# ---------------- Verse Matching, History, Favorites ----------------
class TestVerseFlow:
    match_id = None

    def test_match_requires_auth(self, session):
        r = requests.post(f"{API}/verses/match", json={"problem": "I feel anxious"})
        assert r.status_code == 401

    def test_match_verse(self, session, auth_headers):
        r = session.post(f"{API}/verses/match",
                         headers=auth_headers,
                         json={"problem": "I feel anxious about the future"},
                         timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("id", "problem", "reference", "verse_text", "explanation", "created_at"):
            assert k in d and d[k]
        TestVerseFlow.match_id = d["id"]

    def test_history_contains_match(self, session, auth_headers):
        time.sleep(0.5)
        r = session.get(f"{API}/history", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(i["id"] == TestVerseFlow.match_id for i in items)

    def test_add_favorite(self, session, auth_headers):
        assert TestVerseFlow.match_id, "no match id"
        r = session.post(f"{API}/favorites",
                         headers=auth_headers,
                         json={"match_id": TestVerseFlow.match_id})
        assert r.status_code == 200
        assert r.json()["id"] == TestVerseFlow.match_id

    def test_list_favorites(self, session, auth_headers):
        r = session.get(f"{API}/favorites", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        assert any(i["id"] == TestVerseFlow.match_id for i in items)

    def test_delete_favorite(self, session, auth_headers):
        r = session.delete(f"{API}/favorites/{TestVerseFlow.match_id}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json().get("deleted", 0) >= 1
        # verify gone
        r2 = session.get(f"{API}/favorites", headers=auth_headers)
        assert not any(i["id"] == TestVerseFlow.match_id for i in r2.json())

    def test_favorite_invalid_match(self, session, auth_headers):
        r = session.post(f"{API}/favorites",
                         headers=auth_headers,
                         json={"match_id": "non-existent-id"})
        assert r.status_code == 404


# ---------------- TTS ----------------
class TestTTS:
    def test_tts_generates_audio(self, session, auth_headers):
        r = session.post(f"{API}/tts/generate",
                         headers=auth_headers,
                         json={"text": "Be still and know that I am God."},
                         timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["mime_type"] == "audio/mpeg"
        audio = base64.b64decode(d["audio_base64"])
        # MP3 frames usually start with 'ID3' or 0xFFFB/0xFFF3
        assert len(audio) > 1000
        assert audio[:3] == b"ID3" or audio[0] == 0xFF

    def test_tts_requires_auth(self):
        r = requests.post(f"{API}/tts/generate", json={"text": "hello"})
        assert r.status_code == 401
