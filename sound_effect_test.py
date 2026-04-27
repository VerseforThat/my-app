"""Backend tests for POST /api/tts/sound-effect (ambient splash audio).

Verifies:
  1. No-auth public endpoint (no Authorization header) returns 200
  2. Happy path: returns audio_base64 (>1KB) + mime_type=audio/mpeg
  3. Server-side cache: identical second request returns identical audio AND faster
  4. Validation: empty body -> 422
  5. Regression: /api/tts/generate (auth) still works
"""

import sys
import time
import requests

BASE_URL = "https://verse-match-5.preview.emergentagent.com/api"

TEST_EMAIL = "test@hisword.com"
TEST_PASSWORD = "faith123"
TEST_NAME = "Tester"

PROMPT = (
    "A single soft piano note fading into a gentle warm ambient tone, "
    "minimal and calming, like the opening of a meditation session, "
    "peaceful and therapeutic"
)

results = []


def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    results.append((name, status, detail))
    icon = "[OK]" if ok else "[FAIL]"
    print(f"{icon} {name} :: {detail[:400]}")


def main():
    print(f"BASE_URL = {BASE_URL}\n")

    # ============================================================
    # 1) NO-AUTH: explicitly send WITHOUT Authorization header
    # ============================================================
    print("--- Test 1: No-auth required (first call, no cache) ---")
    t0 = time.time()
    try:
        # Use a clean session and DO NOT send any Authorization header
        r1 = requests.post(
            f"{BASE_URL}/tts/sound-effect",
            json={
                "text": PROMPT,
                "duration_seconds": 12,
                "loop": False,
                "prompt_influence": 0.4,
            },
            headers={"Content-Type": "application/json"},
            timeout=120,
        )
        elapsed1 = time.time() - t0
        log(
            "POST /api/tts/sound-effect WITHOUT Authorization -> not 401",
            r1.status_code != 401,
            f"status={r1.status_code} elapsed={elapsed1:.2f}s",
        )
    except Exception as e:
        elapsed1 = time.time() - t0
        log("POST /api/tts/sound-effect WITHOUT Authorization -> not 401", False, f"error={e}")
        return summarize()

    # ============================================================
    # 2) HAPPY PATH shape
    # ============================================================
    try:
        ok = r1.status_code == 200
        body1 = r1.json() if ok else {}
        b64_1 = body1.get("audio_base64", "")
        mime1 = body1.get("mime_type", "")
        ok_full = (
            ok
            and isinstance(b64_1, str)
            and len(b64_1) > 1000
            and mime1 == "audio/mpeg"
        )
        log(
            "Happy path: 200 + audio_base64 (>1KB) + mime_type=audio/mpeg",
            ok_full,
            f"status={r1.status_code} b64_len={len(b64_1)} mime={mime1!r} elapsed={elapsed1:.2f}s body_keys={list(body1.keys()) if ok else r1.text[:200]}",
        )
    except Exception as e:
        log("Happy path: 200 + audio_base64 + mime_type", False, f"error={e}")
        return summarize()

    if not ok_full:
        # Cannot continue cache test without first audio
        return summarize()

    # ============================================================
    # 3) SERVER-SIDE CACHE: identical second request
    # ============================================================
    print("\n--- Test 3: Server-side cache (identical 2nd request) ---")
    t1 = time.time()
    try:
        r2 = requests.post(
            f"{BASE_URL}/tts/sound-effect",
            json={
                "text": PROMPT,
                "duration_seconds": 12,
                "loop": False,
                "prompt_influence": 0.4,
            },
            headers={"Content-Type": "application/json"},
            timeout=120,
        )
        elapsed2 = time.time() - t1
        ok2 = r2.status_code == 200
        body2 = r2.json() if ok2 else {}
        b64_2 = body2.get("audio_base64", "")

        identical = b64_1 == b64_2 and len(b64_2) > 1000
        log(
            "Cache: 2nd identical request returns identical audio_base64",
            ok2 and identical,
            f"status={r2.status_code} b64_len={len(b64_2)} same_as_first={identical} elapsed_2nd={elapsed2:.2f}s elapsed_1st={elapsed1:.2f}s",
        )

        # Cache should be substantially faster. We assert elapsed2 < 1s OR at
        # least 5x faster than first. ElevenLabs generation usually >5s, cache hit <0.5s.
        faster = elapsed2 < 1.0 or (elapsed1 > 0 and elapsed2 < elapsed1 / 3.0)
        log(
            "Cache: 2nd identical request is noticeably faster",
            faster,
            f"elapsed_1st={elapsed1:.2f}s elapsed_2nd={elapsed2:.2f}s",
        )
    except Exception as e:
        log("Cache: 2nd identical request returns identical audio_base64", False, f"error={e}")

    # ============================================================
    # 4) VALIDATION: empty body -> 422
    # ============================================================
    print("\n--- Test 4: Validation (empty body) ---")
    try:
        r3 = requests.post(
            f"{BASE_URL}/tts/sound-effect",
            json={},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        log(
            "POST /api/tts/sound-effect with empty body -> 422",
            r3.status_code == 422,
            f"status={r3.status_code} body={r3.text[:300]}",
        )
    except Exception as e:
        log("POST /api/tts/sound-effect with empty body -> 422", False, f"error={e}")

    # ============================================================
    # 5) REGRESSION: POST /api/tts/generate (auth) still works
    # ============================================================
    print("\n--- Test 5: Regression /api/tts/generate (auth) ---")
    token = None
    try:
        r = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            timeout=30,
        )
        if r.status_code == 200:
            token = r.json().get("access_token")
        elif r.status_code in (400, 401):
            # try signup
            s = requests.post(
                f"{BASE_URL}/auth/signup",
                json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": TEST_NAME},
                timeout=30,
            )
            if s.status_code == 200:
                token = s.json().get("access_token")
        log(
            "Auth login for regression test",
            bool(token),
            f"status={r.status_code} got_token={bool(token)}",
        )
    except Exception as e:
        log("Auth login for regression test", False, str(e))

    if token:
        try:
            r = requests.post(
                f"{BASE_URL}/tts/generate",
                json={"text": "Hello world"},
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                },
                timeout=120,
            )
            ok = r.status_code == 200
            body = r.json() if ok else {}
            b64 = body.get("audio_base64", "")
            ok_full = ok and len(b64) > 1000
            log(
                "POST /api/tts/generate (auth) returns 200 + audio_base64",
                ok_full,
                f"status={r.status_code} b64_len={len(b64)}",
            )
        except Exception as e:
            log("POST /api/tts/generate (auth) returns 200 + audio_base64", False, str(e))

        # Verify /tts/generate WITHOUT auth -> 401/403 (sanity that auth is enforced)
        try:
            r = requests.post(
                f"{BASE_URL}/tts/generate",
                json={"text": "Hello world"},
                headers={"Content-Type": "application/json"},
                timeout=30,
            )
            log(
                "POST /api/tts/generate WITHOUT auth -> 401/403 (sanity)",
                r.status_code in (401, 403),
                f"status={r.status_code}",
            )
        except Exception as e:
            log("POST /api/tts/generate WITHOUT auth -> 401/403 (sanity)", False, str(e))

    return summarize()


def summarize():
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    fails = [r for r in results if r[1] == "FAIL"]
    passes = [r for r in results if r[1] == "PASS"]
    for name, status, detail in results:
        print(f"{status}  {name}")
        if status == "FAIL":
            print(f"      -> {detail}")
    print(f"\n{len(passes)} passed, {len(fails)} failed (total {len(results)})")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
