"""
Tests for POST /api/tts/transcribe (ElevenLabs Speech-to-Text).
Also runs regression on /api/tts/sound-effect (no auth, cache hit) and
/api/tts/generate (auth).

Note: Real ElevenLabs round-trip — happy-path TTS->STT runs ONCE.
"""
import base64
import os
import sys
import time
import json
import requests

BASE_URL = "https://verse-match-5.preview.emergentagent.com/api"
EMAIL = "test@hisword.com"
PASSWORD = "faith123"

SOUND_PROMPT = (
    "A single soft piano note fading into a gentle warm ambient tone, "
    "minimal and calming, like the opening of a meditation session, "
    "peaceful and therapeutic"
)

results = []


def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {detail}")
    results.append((name, ok, detail))


def login() -> str:
    r = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        timeout=20,
    )
    if r.status_code != 200:
        # try signup
        rs = requests.post(
            f"{BASE_URL}/auth/signup",
            json={"email": EMAIL, "password": PASSWORD, "name": "Tester"},
            timeout=20,
        )
        if rs.status_code not in (200, 201):
            raise RuntimeError(f"login+signup failed: {r.status_code} {r.text} / {rs.status_code} {rs.text}")
        return rs.json()["access_token"]
    return r.json()["access_token"]


def test_auth_required():
    r = requests.post(
        f"{BASE_URL}/tts/transcribe",
        json={"audio_base64": "aGVsbG8="},
        timeout=20,
    )
    record(
        "transcribe requires auth (no Authorization header -> 401)",
        r.status_code in (401, 403),
        f"status={r.status_code} body={r.text[:120]}",
    )


def test_invalid_base64(token):
    r = requests.post(
        f"{BASE_URL}/tts/transcribe",
        json={"audio_base64": "not-valid-base64!!!"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    ok = r.status_code == 400
    detail_ok = False
    try:
        detail_ok = "Invalid base64 audio" in (r.json().get("detail") or "")
    except Exception:
        pass
    record(
        "transcribe invalid base64 -> 400 'Invalid base64 audio'",
        ok and detail_ok,
        f"status={r.status_code} body={r.text[:160]}",
    )


def test_too_short(token):
    # "aGk=" decodes to "hi" (2 bytes)
    r = requests.post(
        f"{BASE_URL}/tts/transcribe",
        json={"audio_base64": "aGk="},
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    ok = r.status_code == 400
    detail_ok = False
    try:
        detail_ok = "Recording too short" in (r.json().get("detail") or "")
    except Exception:
        pass
    record(
        "transcribe too-short payload -> 400 'Recording too short'",
        ok and detail_ok,
        f"status={r.status_code} body={r.text[:160]}",
    )


def test_validation_missing_field(token):
    r = requests.post(
        f"{BASE_URL}/tts/transcribe",
        json={},
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    record(
        "transcribe missing audio_base64 -> 422",
        r.status_code == 422,
        f"status={r.status_code} body={r.text[:160]}",
    )


def test_happy_path(token):
    """One real round-trip: TTS 'Hello world this is a test' -> b64 -> STT."""
    phrase = "Hello world this is a test"
    t0 = time.time()
    rt = requests.post(
        f"{BASE_URL}/tts/generate",
        json={"text": phrase},
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    if rt.status_code != 200:
        record(
            "tts/generate prerequisite for STT happy path",
            False,
            f"status={rt.status_code} body={rt.text[:200]}",
        )
        return
    audio_b64 = rt.json().get("audio_base64") or ""
    if not audio_b64:
        record("tts/generate returned empty audio_base64", False, "")
        return
    tts_dur = time.time() - t0

    t1 = time.time()
    r = requests.post(
        f"{BASE_URL}/tts/transcribe",
        json={"audio_base64": audio_b64, "language_code": "en"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=120,
    )
    stt_dur = time.time() - t1

    if r.status_code != 200:
        record(
            "transcribe happy path -> 200 with text containing 'hello' and 'world'",
            False,
            f"status={r.status_code} body={r.text[:300]} stt_dur={stt_dur:.2f}s",
        )
        return
    body = r.json()
    text = (body.get("text") or "").lower()
    has_hello = "hello" in text
    has_world = "world" in text
    record(
        "transcribe happy path -> 200 with text containing 'hello' and 'world'",
        bool(text) and has_hello and has_world,
        f"text={text!r} tts_dur={tts_dur:.2f}s stt_dur={stt_dur:.2f}s b64_len={len(audio_b64)}",
    )


def test_regression_sound_effect():
    """No auth — same prompt as previous test should be a cache hit + identical bytes."""
    payload = {
        "text": SOUND_PROMPT,
        "duration_seconds": 12,
        "loop": False,
        "prompt_influence": 0.4,
    }
    t0 = time.time()
    r = requests.post(f"{BASE_URL}/tts/sound-effect", json=payload, timeout=120)
    dur = time.time() - t0
    if r.status_code != 200:
        record(
            "tts/sound-effect (no auth) returns 200",
            False,
            f"status={r.status_code} body={r.text[:200]} dur={dur:.2f}s",
        )
        return
    b64 = r.json().get("audio_base64") or ""
    record(
        "tts/sound-effect (no auth) returns 200 with audio_base64",
        len(b64) > 1000 and r.json().get("mime_type") == "audio/mpeg",
        f"b64_len={len(b64)} dur={dur:.2f}s mime={r.json().get('mime_type')}",
    )

    # Cache hit assertion (should be quick)
    t1 = time.time()
    r2 = requests.post(f"{BASE_URL}/tts/sound-effect", json=payload, timeout=60)
    dur2 = time.time() - t1
    if r2.status_code != 200:
        record(
            "tts/sound-effect cache-hit returns 200",
            False,
            f"status={r2.status_code} body={r2.text[:200]} dur={dur2:.2f}s",
        )
        return
    b64_2 = r2.json().get("audio_base64") or ""
    record(
        "tts/sound-effect cache hit (identical bytes, faster than first)",
        b64 == b64_2 and dur2 < max(dur, 1.0),
        f"identical={b64==b64_2} first_dur={dur:.2f}s second_dur={dur2:.2f}s",
    )


def test_regression_tts_generate(token):
    r = requests.post(
        f"{BASE_URL}/tts/generate",
        json={"text": "Hello world"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=60,
    )
    ok = (
        r.status_code == 200
        and len((r.json().get("audio_base64") or "")) > 1000
        and r.json().get("mime_type") == "audio/mpeg"
    )
    record(
        "tts/generate (auth) returns audio_base64",
        ok,
        f"status={r.status_code} b64_len={len((r.json() or {}).get('audio_base64',''))}",
    )

    # And without auth -> 401
    r2 = requests.post(
        f"{BASE_URL}/tts/generate",
        json={"text": "Hello world"},
        timeout=20,
    )
    record(
        "tts/generate without auth -> 401",
        r2.status_code in (401, 403),
        f"status={r2.status_code}",
    )


def main():
    print(f"Base URL: {BASE_URL}")
    token = login()
    print(f"Logged in as {EMAIL}")

    # Auth + validation tests (cheap, no ElevenLabs cost)
    test_auth_required()
    test_invalid_base64(token)
    test_too_short(token)
    test_validation_missing_field(token)

    # Regression first (cheap; sound-effect should be cache hit, tts/generate is small)
    test_regression_sound_effect()
    test_regression_tts_generate(token)

    # Real ElevenLabs round-trip — runs ONCE
    test_happy_path(token)

    failed = [r for r in results if not r[1]]
    print("\n=========")
    print(f"Total: {len(results)}  Passed: {len(results)-len(failed)}  Failed: {len(failed)}")
    if failed:
        for n, _, d in failed:
            print(f"  FAIL: {n} :: {d}")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
