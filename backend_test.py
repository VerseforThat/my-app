"""Backend tests for Verse for That refactor (v2.0).

Verifies:
- Auth signup/login with trimmed UserResponse (no premium fields)
- /api/verses/match: no 402, returns DIFFERENT references on repeat call
- /api/verses/{id}/context, /api/verses/{id}/explanation, /api/verses/{id}/related
- /api/verses/search by reference and topic
- Removed Stripe routes return 404
- Regression: auth/me, settings/translation, history, favorites, tts, daily-verse
"""

import os
import sys
import json
import time
import requests

BASE_URL = "https://verse-match-5.preview.emergentagent.com/api"

TEST_EMAIL = "test@hisword.com"
TEST_PASSWORD = "faith123"
TEST_NAME = "Tester"

PASS = "PASS"
FAIL = "FAIL"

results = []  # list of (name, status, detail)


def log(name, ok, detail=""):
    status = PASS if ok else FAIL
    results.append((name, status, detail))
    icon = "[OK]" if ok else "[FAIL]"
    print(f"{icon} {name} :: {detail[:300]}")


def post(path, json_body=None, token=None, timeout=90):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.post(BASE_URL + path, json=json_body, headers=headers, timeout=timeout)


def get(path, token=None, timeout=90):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.get(BASE_URL + path, headers=headers, timeout=timeout)


def patch(path, json_body=None, token=None, timeout=30):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.patch(BASE_URL + path, json=json_body, headers=headers, timeout=timeout)


def delete(path, token=None, timeout=30):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.delete(BASE_URL + path, headers=headers, timeout=timeout)


def ensure_user_token():
    # Try login; if 401 then signup; in all other failures, signup may succeed if missing
    r = post("/auth/login", {"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if r.status_code == 200:
        return r.json()
    if r.status_code in (400, 401):
        s = post("/auth/signup", {"email": TEST_EMAIL, "password": TEST_PASSWORD, "name": TEST_NAME})
        if s.status_code == 200:
            return s.json()
        # If signup says already registered, password may be different — try a unique email
        if s.status_code == 400:
            # fall through; create alternate user just for tests
            alt = f"tester_{int(time.time())}@hisword.com"
            s2 = post("/auth/signup", {"email": alt, "password": TEST_PASSWORD, "name": "Alt Tester"})
            if s2.status_code == 200:
                print(f"Used alternate test email: {alt}")
                return s2.json()
            raise RuntimeError(f"Login failed and signup failed: {s.status_code} {s.text} / alt {s2.status_code} {s2.text}")
        raise RuntimeError(f"Login {r.status_code} & signup {s.status_code} {s.text}")
    raise RuntimeError(f"Unexpected login response {r.status_code} {r.text}")


def main():
    print(f"BASE_URL = {BASE_URL}")

    # ---------- Health ----------
    try:
        r = get("/")
        log("GET /api/ root health", r.status_code == 200, f"status={r.status_code} body={r.text[:120]}")
    except Exception as e:
        log("GET /api/ root health", False, str(e))

    # ---------- 1) Signup-or-login & shape ----------
    try:
        # Try signup first with a fresh email to verify NEW signup shape (without polluting test acct)
        fresh_email = f"newuser_{int(time.time())}@hisword.com"
        s = post("/auth/signup", {"email": fresh_email, "password": "faith123", "name": "Fresh User"})
        ok = s.status_code == 200
        body = s.json() if ok else {}
        user = body.get("user", {})
        forbidden = [k for k in ("is_premium", "verses_used", "free_verses_remaining", "subscription_status") if k in user]
        ok_shape = ok and "access_token" in body and set(user.keys()) <= {"id", "email", "name", "bible_translation"} and not forbidden
        log(
            "POST /api/auth/signup (new user, no premium fields)",
            ok_shape,
            f"status={s.status_code} user_keys={list(user.keys())} forbidden_present={forbidden}",
        )
    except Exception as e:
        log("POST /api/auth/signup (new user, no premium fields)", False, str(e))

    # Now ensure our standard test user token
    try:
        auth = ensure_user_token()
        token = auth["access_token"]
        user = auth.get("user", {})
        forbidden = [k for k in ("is_premium", "verses_used", "free_verses_remaining", "subscription_status") if k in user]
        ok_shape = (set(user.keys()) <= {"id", "email", "name", "bible_translation"}) and not forbidden
        log(
            "POST /api/auth/login shape (no premium fields)",
            ok_shape,
            f"user_keys={list(user.keys())} forbidden_present={forbidden}",
        )
    except Exception as e:
        log("POST /api/auth/login shape (no premium fields)", False, str(e))
        print("Cannot continue without auth token.")
        return summarize()

    # ---------- /api/auth/me ----------
    try:
        r = get("/auth/me", token=token)
        body = r.json() if r.status_code == 200 else {}
        forbidden = [k for k in ("is_premium", "verses_used", "free_verses_remaining", "subscription_status") if k in body]
        ok = r.status_code == 200 and set(body.keys()) <= {"id", "email", "name", "bible_translation"} and not forbidden
        log("GET /api/auth/me", ok, f"status={r.status_code} keys={list(body.keys())}")
    except Exception as e:
        log("GET /api/auth/me", False, str(e))

    # ---------- 2) Verse match — no 402, ever ----------
    match1 = None
    match2 = None
    try:
        r1 = post("/verses/match", {"problem": "I feel anxious about the future"}, token=token)
        ok1 = r1.status_code == 200
        if r1.status_code == 402:
            log("POST /api/verses/match returns 200 (no paywall)", False, "Got 402 — paywall still active!")
        else:
            log("POST /api/verses/match returns 200 (no paywall)", ok1, f"status={r1.status_code} body={r1.text[:200]}")
        if ok1:
            match1 = r1.json()
            required = {"id", "problem", "reference", "verse_text", "explanation", "created_at"}
            ok_shape = required.issubset(match1.keys())
            log("POST /api/verses/match response shape", ok_shape, f"keys={list(match1.keys())}")
    except Exception as e:
        log("POST /api/verses/match returns 200 (no paywall)", False, str(e))

    # ---------- 3) Variety: same problem -> different reference ----------
    try:
        r2 = post("/verses/match", {"problem": "I feel anxious about the future"}, token=token)
        ok2 = r2.status_code == 200
        if ok2:
            match2 = r2.json()
        if match1 and match2:
            different = match1["reference"] != match2["reference"]
            log(
                "POST /api/verses/match variety (same problem -> different reference)",
                different,
                f"first={match1['reference']!r} second={match2['reference']!r}",
            )
        else:
            log("POST /api/verses/match variety (same problem -> different reference)", False,
                f"r2.status={r2.status_code} body={r2.text[:200]}")
    except Exception as e:
        log("POST /api/verses/match variety (same problem -> different reference)", False, str(e))

    # ---------- 4) /context ----------
    if match1:
        try:
            r = get(f"/verses/{match1['id']}/context", token=token)
            ok = r.status_code == 200
            body = r.json() if ok else {}
            ok = ok and "reference" in body and "context_text" in body and len(body.get("context_text", "")) > 20
            log("GET /api/verses/{id}/context", ok, f"status={r.status_code} ref={body.get('reference')!r} ctx_len={len(body.get('context_text',''))}")
        except Exception as e:
            log("GET /api/verses/{id}/context", False, str(e))

    # ---------- 5) /explanation ----------
    if match1:
        try:
            r = get(f"/verses/{match1['id']}/explanation", token=token)
            ok = r.status_code == 200
            body = r.json() if ok else {}
            expl = body.get("explanation", "")
            # multi-sentence: at least 3 sentence-ending punctuation marks
            sentence_count = expl.count(".") + expl.count("!") + expl.count("?")
            ok = ok and "reference" in body and isinstance(expl, str) and sentence_count >= 3 and len(expl) >= 200
            log("GET /api/verses/{id}/explanation", ok,
                f"status={r.status_code} ref={body.get('reference')!r} sent_marks={sentence_count} len={len(expl)}")
        except Exception as e:
            log("GET /api/verses/{id}/explanation", False, str(e))

    # /explanation 404 for bogus id
    try:
        r = get("/verses/this-is-not-real-uuid/explanation", token=token)
        log("GET /api/verses/{bogus}/explanation -> 404", r.status_code == 404, f"status={r.status_code}")
    except Exception as e:
        log("GET /api/verses/{bogus}/explanation -> 404", False, str(e))

    # ---------- 6) /related ----------
    if match1:
        try:
            r = get(f"/verses/{match1['id']}/related", token=token)
            ok = r.status_code == 200
            body = r.json() if ok else {}
            items = body.get("items", [])
            none_equals_orig = all(it.get("reference") != match1["reference"] for it in items)
            shape_ok = all({"reference", "verse_text", "note"}.issubset(it.keys()) for it in items)
            ok = ok and len(items) >= 2 and none_equals_orig and shape_ok
            log("GET /api/verses/{id}/related (>=2 items, none == original)",
                ok,
                f"status={r.status_code} count={len(items)} refs={[i.get('reference') for i in items]}")
        except Exception as e:
            log("GET /api/verses/{id}/related (>=2 items, none == original)", False, str(e))

    # ---------- 7) Search by reference ----------
    try:
        r = post("/verses/search", {"query": "John 3:16"}, token=token)
        ok = r.status_code == 200
        body = r.json() if ok else {}
        items = body.get("items", [])
        has_john316 = any("john 3:16" in (it.get("reference", "").lower()) for it in items)
        ok = ok and body.get("query") == "John 3:16" and len(items) >= 1 and has_john316
        log("POST /api/verses/search reference 'John 3:16'", ok,
            f"status={r.status_code} count={len(items)} refs={[i.get('reference') for i in items]}")
    except Exception as e:
        log("POST /api/verses/search reference 'John 3:16'", False, str(e))

    # ---------- 8) Search by topic ----------
    try:
        r = post("/verses/search", {"query": "love"}, token=token)
        ok = r.status_code == 200
        body = r.json() if ok else {}
        items = body.get("items", [])
        ok = ok and len(items) >= 2
        log("POST /api/verses/search topic 'love' (multiple items)", ok,
            f"status={r.status_code} count={len(items)} refs={[i.get('reference') for i in items]}")
    except Exception as e:
        log("POST /api/verses/search topic 'love' (multiple items)", False, str(e))

    # ---------- 9) Removed Stripe endpoints ----------
    for path, method in [
        ("/subscription/checkout", "POST"),
        ("/subscription/portal", "POST"),
        ("/webhook/stripe", "POST"),
    ]:
        try:
            r = post(path, {}, token=token) if method == "POST" else get(path, token=token)
            log(f"REMOVED endpoint {method} {path} -> 404", r.status_code == 404,
                f"status={r.status_code} body={r.text[:100]}")
        except Exception as e:
            log(f"REMOVED endpoint {method} {path} -> 404", False, str(e))

    # ---------- Regression: settings/translation ----------
    try:
        r = patch("/settings/translation", {"translation": "KJV"}, token=token)
        ok = r.status_code == 200 and r.json().get("bible_translation") == "KJV"
        log("PATCH /api/settings/translation -> KJV", ok, f"status={r.status_code} body={r.text[:200]}")
        # restore
        patch("/settings/translation", {"translation": "NIV"}, token=token)
    except Exception as e:
        log("PATCH /api/settings/translation -> KJV", False, str(e))

    # ---------- Regression: history ----------
    try:
        r = get("/history", token=token)
        ok = r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) >= 1
        log("GET /api/history", ok, f"status={r.status_code} count={len(r.json()) if r.status_code==200 else 'NA'}")
    except Exception as e:
        log("GET /api/history", False, str(e))

    # ---------- Regression: favorites POST/GET/DELETE ----------
    if match1:
        try:
            r = post("/favorites", {"match_id": match1["id"]}, token=token)
            ok = r.status_code == 200 and r.json().get("id") == match1["id"]
            log("POST /api/favorites add", ok, f"status={r.status_code}")
        except Exception as e:
            log("POST /api/favorites add", False, str(e))

        try:
            r = get("/favorites", token=token)
            favs = r.json() if r.status_code == 200 else []
            ok = r.status_code == 200 and any(f["id"] == match1["id"] for f in favs)
            log("GET /api/favorites", ok, f"status={r.status_code} count={len(favs)}")
        except Exception as e:
            log("GET /api/favorites", False, str(e))

        try:
            r = delete(f"/favorites/{match1['id']}", token=token)
            ok = r.status_code == 200 and r.json().get("deleted", 0) >= 1
            log("DELETE /api/favorites/{id}", ok, f"status={r.status_code} body={r.text[:100]}")
        except Exception as e:
            log("DELETE /api/favorites/{id}", False, str(e))

    # ---------- Regression: TTS ----------
    try:
        r = post("/tts/generate", {"text": "Be still and know that I am God."}, token=token, timeout=120)
        ok = r.status_code == 200 and len(r.json().get("audio_base64", "")) > 1000
        log("POST /api/tts/generate", ok,
            f"status={r.status_code} audio_b64_len={len(r.json().get('audio_base64','')) if r.status_code==200 else 'NA'}")
    except Exception as e:
        log("POST /api/tts/generate", False, str(e))

    # ---------- Regression: daily-verse ----------
    try:
        r = get("/daily-verse", timeout=90)
        body = r.json() if r.status_code == 200 else {}
        ok = r.status_code == 200 and {"reference", "verse_text", "explanation", "date"}.issubset(body.keys())
        log("GET /api/daily-verse", ok, f"status={r.status_code} ref={body.get('reference')!r}")
    except Exception as e:
        log("GET /api/daily-verse", False, str(e))

    return summarize()


def summarize():
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    fails = [r for r in results if r[1] == FAIL]
    passes = [r for r in results if r[1] == PASS]
    for name, status, detail in results:
        print(f"{status}  {name}")
        if status == FAIL:
            print(f"      -> {detail}")
    print(f"\n{len(passes)} passed, {len(fails)} failed (total {len(results)})")
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())
