"""Partial follow-up tests since the happy path is blocked by an ElevenLabs API
key permission error (sound_generation not enabled on the key).

Still verifies:
  - No-auth: endpoint reachable WITHOUT Authorization (we DO get a non-401)
  - Validation: empty body -> 422
  - Regression: /api/tts/generate (text-to-speech) still works with auth
  - Regression: /api/tts/generate WITHOUT auth -> 401/403
"""
import sys, time, requests

BASE_URL = "https://verse-match-5.preview.emergentagent.com/api"
TEST_EMAIL = "test@hisword.com"
TEST_PASSWORD = "faith123"
TEST_NAME = "Tester"

results = []
def log(name, ok, detail=""):
    results.append((name, "PASS" if ok else "FAIL", detail))
    print(f"{'[OK]' if ok else '[FAIL]'} {name} :: {detail[:300]}")

# 1) No-auth, but malformed (so we don't burn an LLM call on a key that fails)
print("\n--- Validation: empty body ---")
r = requests.post(f"{BASE_URL}/tts/sound-effect", json={}, timeout=30)
log("Empty body -> 422", r.status_code == 422, f"status={r.status_code} body={r.text[:200]}")

# 2) Confirm no-auth: status not 401 (we already saw 500 from ElevenLabs perm)
print("\n--- No-auth: confirm endpoint isn't 401-protected ---")
r = requests.post(
    f"{BASE_URL}/tts/sound-effect",
    json={"text": "x", "duration_seconds": 1, "loop": False, "prompt_influence": 0.3},
    timeout=60,
)
log("No-auth call NOT rejected with 401/403", r.status_code not in (401, 403),
    f"status={r.status_code} body={r.text[:200]}")

# 3) Login + /tts/generate (regression)
print("\n--- Regression /tts/generate (auth) ---")
r = requests.post(f"{BASE_URL}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=30)
token = r.json().get("access_token") if r.status_code == 200 else None
if not token:
    s = requests.post(f"{BASE_URL}/auth/signup",
                      json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": TEST_NAME}, timeout=30)
    token = s.json().get("access_token") if s.status_code == 200 else None
log("Login obtained token", bool(token), f"have_token={bool(token)}")

if token:
    t0 = time.time()
    r = requests.post(
        f"{BASE_URL}/tts/generate",
        json={"text": "Hello world"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=120,
    )
    elapsed = time.time() - t0
    ok = r.status_code == 200
    body = r.json() if ok else {}
    b64 = body.get("audio_base64", "")
    log("/tts/generate (auth) -> 200 + audio_base64 >1KB",
        ok and len(b64) > 1000,
        f"status={r.status_code} b64_len={len(b64)} mime={body.get('mime_type')!r} elapsed={elapsed:.2f}s")

    # /tts/generate without auth -> 401
    r = requests.post(f"{BASE_URL}/tts/generate", json={"text": "Hello"}, timeout=30)
    log("/tts/generate WITHOUT auth -> 401/403", r.status_code in (401, 403),
        f"status={r.status_code}")

# Summary
print("\n" + "=" * 70)
fails = [r for r in results if r[1] == "FAIL"]
for n, s, d in results:
    print(f"{s}  {n}")
    if s == "FAIL":
        print(f"      -> {d}")
print(f"\n{len(results) - len(fails)} passed, {len(fails)} failed (total {len(results)})")
sys.exit(0 if not fails else 1)
