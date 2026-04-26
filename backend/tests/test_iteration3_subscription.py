"""
Iteration 3 backend tests: real Stripe auto-renewing subscriptions
- Stripe SDK + user's own test key
- mode=subscription with trial_period_days=7
- Stripe Customer Portal
- Webhook handler updates user subscription_status
- Regression on baseline flows (signup/login/verse-match/translation/etc.)
"""
import os
import time
import uuid
import json
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
# Frontend .env points to public preview; tests against /api prefix
FRONTEND_ENV = "/app/frontend/.env"
if not BASE_URL:
    with open(FRONTEND_ENV) as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL") or line.startswith("EXPO_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break
API = f"{BASE_URL}/api"

ORIGIN = BASE_URL  # used as origin_url for checkout


# ---------- shared fixtures ----------
def _signup(email: str, password: str = "faith123", name: str = "T3"):
    r = requests.post(f"{API}/auth/signup", json={"email": email, "password": password, "name": name}, timeout=30)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    return r.json()


def _login(email: str, password: str = "faith123"):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def _auth(token: str):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def free_user():
    email = f"TEST_it3_free_{uuid.uuid4().hex[:8]}@hisword.com"
    data = _signup(email)
    return {"email": email, "token": data["access_token"], "id": data["user"]["id"]}


@pytest.fixture(scope="module")
def trial_user():
    email = f"TEST_it3_trial_{uuid.uuid4().hex[:8]}@hisword.com"
    data = _signup(email)
    return {"email": email, "token": data["access_token"], "id": data["user"]["id"]}


@pytest.fixture(scope="module")
def webhook_user():
    email = f"TEST_it3_webhook_{uuid.uuid4().hex[:8]}@hisword.com"
    data = _signup(email)
    return {"email": email, "token": data["access_token"], "id": data["user"]["id"]}


# ---------- Health & baseline ----------
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


class TestAuthBaseline:
    def test_signup_login_me(self):
        email = f"TEST_it3_base_{uuid.uuid4().hex[:8]}@hisword.com"
        s = _signup(email)
        assert s["user"]["subscription_status"] == "free"
        assert s["user"]["is_premium"] is False
        assert s["user"]["free_verses_remaining"] == 3

        l = _login(email)
        assert l["access_token"]
        r = requests.get(f"{API}/auth/me", headers=_auth(l["access_token"]), timeout=15)
        assert r.status_code == 200
        u = r.json()
        assert u["email"].lower() == email.lower()
        assert u["bible_translation"] == "NIV"


# ---------- Subscription checkout ----------
class TestSubscriptionCheckout:
    def test_checkout_returns_real_stripe_url_with_trial(self, free_user):
        r = requests.post(
            f"{API}/subscription/checkout",
            json={"origin_url": ORIGIN},
            headers=_auth(free_user["token"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body and "session_id" in body
        assert body["url"].startswith("https://checkout.stripe.com/"), body["url"]
        assert body["session_id"].startswith("cs_test_"), body["session_id"]
        assert body.get("trial_days") == 7

    def test_status_for_unpaid_session_does_not_grant_premium(self, free_user):
        # create a fresh checkout session
        c = requests.post(
            f"{API}/subscription/checkout",
            json={"origin_url": ORIGIN},
            headers=_auth(free_user["token"]),
            timeout=30,
        ).json()
        session_id = c["session_id"]
        r = requests.get(
            f"{API}/subscription/status/{session_id}",
            headers=_auth(free_user["token"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["payment_status"] in ("unpaid", "pending", "no_payment_required"), body
        assert body["user"]["is_premium"] is False
        assert body["user"]["subscription_status"] in ("free", "incomplete")

    def test_already_active_user_cannot_checkout(self, webhook_user):
        # Force active state via webhook simulation, then attempt checkout
        # First create customer via checkout
        c = requests.post(
            f"{API}/subscription/checkout",
            json={"origin_url": ORIGIN},
            headers=_auth(webhook_user["token"]),
            timeout=30,
        )
        assert c.status_code == 200

        # Simulate active subscription via webhook
        future = int(time.time()) + 30 * 86400
        evt = {
            "id": f"evt_test_{uuid.uuid4().hex[:8]}",
            "object": "event",
            "type": "customer.subscription.updated",
            "data": {
                "object": {
                    "id": f"sub_test_{uuid.uuid4().hex[:8]}",
                    "object": "subscription",
                    "status": "active",
                    "current_period_end": future,
                    "metadata": {"user_id": webhook_user["id"]},
                    "customer": "cus_xxx",
                    "cancel_at_period_end": False,
                }
            },
        }
        wr = requests.post(f"{API}/webhook/stripe", json=evt, timeout=15)
        assert wr.status_code == 200, wr.text

        # Confirm /auth/me shows premium active
        me = requests.get(f"{API}/auth/me", headers=_auth(webhook_user["token"]), timeout=15).json()
        assert me["subscription_status"] == "active"
        assert me["is_premium"] is True

        # Attempt second checkout -> 400
        r = requests.post(
            f"{API}/subscription/checkout",
            json={"origin_url": ORIGIN},
            headers=_auth(webhook_user["token"]),
            timeout=30,
        )
        assert r.status_code == 400, r.text
        assert "active subscription" in r.json()["detail"].lower()


# ---------- Portal ----------
class TestSubscriptionPortal:
    def test_portal_without_customer_returns_400(self):
        # fresh user with NO stripe_customer_id
        email = f"TEST_it3_noportal_{uuid.uuid4().hex[:8]}@hisword.com"
        u = _signup(email)
        r = requests.post(
            f"{API}/subscription/portal",
            json={"origin_url": ORIGIN},
            headers=_auth(u["access_token"]),
            timeout=30,
        )
        assert r.status_code == 400, r.text
        assert "subscription" in r.json()["detail"].lower() or "customer" in r.json()["detail"].lower()

    def test_portal_with_customer_returns_billing_url(self, free_user):
        # free_user already had checkout above, so has stripe_customer_id
        r = requests.post(
            f"{API}/subscription/portal",
            json={"origin_url": ORIGIN},
            headers=_auth(free_user["token"]),
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body
        assert body["url"].startswith("https://billing.stripe.com/"), body["url"]


# ---------- Webhook ----------
class TestWebhook:
    def test_webhook_malformed_returns_400(self):
        r = requests.post(
            f"{API}/webhook/stripe",
            data="not-json-at-all",
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_webhook_no_signature_dev_mode_accepts(self, trial_user):
        future = int(time.time()) + 7 * 86400
        evt = {
            "id": f"evt_test_{uuid.uuid4().hex[:8]}",
            "object": "event",
            "type": "customer.subscription.created",
            "data": {
                "object": {
                    "id": f"sub_test_{uuid.uuid4().hex[:8]}",
                    "object": "subscription",
                    "status": "trialing",
                    "current_period_end": future,
                    "metadata": {"user_id": trial_user["id"]},
                    "customer": "cus_test",
                    "cancel_at_period_end": False,
                }
            },
        }
        r = requests.post(f"{API}/webhook/stripe", json=evt, timeout=15)
        assert r.status_code == 200
        assert r.json().get("received") is True

        # Verify user transitioned to trialing + premium
        me = requests.get(f"{API}/auth/me", headers=_auth(trial_user["token"]), timeout=15).json()
        assert me["subscription_status"] == "trialing"
        assert me["is_premium"] is True
        assert me["current_period_end"] is not None

    def test_webhook_subscription_updated_active(self, trial_user):
        future = int(time.time()) + 30 * 86400
        evt = {
            "id": f"evt_test_{uuid.uuid4().hex[:8]}",
            "type": "customer.subscription.updated",
            "data": {"object": {
                "id": "sub_test_active",
                "status": "active",
                "current_period_end": future,
                "metadata": {"user_id": trial_user["id"]},
                "customer": "cus_test",
                "cancel_at_period_end": False,
            }},
        }
        r = requests.post(f"{API}/webhook/stripe", json=evt, timeout=15)
        assert r.status_code == 200
        me = requests.get(f"{API}/auth/me", headers=_auth(trial_user["token"]), timeout=15).json()
        assert me["subscription_status"] == "active"
        assert me["is_premium"] is True

    def test_webhook_subscription_deleted(self, trial_user):
        evt = {
            "id": f"evt_test_{uuid.uuid4().hex[:8]}",
            "type": "customer.subscription.deleted",
            "data": {"object": {
                "id": "sub_test_active",
                "status": "canceled",
                "current_period_end": int(time.time()) - 100,
                "metadata": {"user_id": trial_user["id"]},
                "customer": "cus_test",
                "cancel_at_period_end": False,
            }},
        }
        r = requests.post(f"{API}/webhook/stripe", json=evt, timeout=15)
        assert r.status_code == 200
        me = requests.get(f"{API}/auth/me", headers=_auth(trial_user["token"]), timeout=15).json()
        assert me["subscription_status"] == "canceled"
        assert me["is_premium"] is False


# ---------- Legacy endpoint removed ----------
class TestLegacy:
    def test_start_trial_legacy_returns_400(self, free_user):
        r = requests.post(
            f"{API}/subscription/start-trial",
            headers=_auth(free_user["token"]),
            timeout=15,
        )
        assert r.status_code == 400, r.text
        assert "card-free" in r.json()["detail"].lower() or "no longer" in r.json()["detail"].lower()


# ---------- Regression: baseline flows ----------
class TestRegression:
    def test_translation_switch(self):
        email = f"TEST_it3_kjv_{uuid.uuid4().hex[:8]}@hisword.com"
        u = _signup(email)
        token = u["access_token"]
        r = requests.patch(
            f"{API}/settings/translation",
            json={"translation": "KJV"},
            headers=_auth(token),
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["bible_translation"] == "KJV"

    def test_daily_verse(self):
        r = requests.get(f"{API}/daily-verse", timeout=60)
        assert r.status_code == 200
        body = r.json()
        for k in ("reference", "verse_text", "explanation", "date"):
            assert k in body and body[k]

    def test_verse_match_and_quota_cap(self):
        email = f"TEST_it3_quota_{uuid.uuid4().hex[:8]}@hisword.com"
        u = _signup(email)
        token = u["access_token"]
        for i in range(3):
            r = requests.post(
                f"{API}/verses/match",
                json={"problem": f"I am anxious today number {i}"},
                headers=_auth(token),
                timeout=120,
            )
            assert r.status_code == 200, f"Match {i} failed: {r.status_code} {r.text[:200]}"
        # 4th call should be 402
        r = requests.post(
            f"{API}/verses/match",
            json={"problem": "And one more"},
            headers=_auth(token),
            timeout=60,
        )
        assert r.status_code == 402, r.text
        detail = r.json().get("detail", {})
        assert detail.get("error") == "free_limit_reached"

    def test_history_and_favorites(self):
        email = f"TEST_it3_hist_{uuid.uuid4().hex[:8]}@hisword.com"
        u = _signup(email)
        token = u["access_token"]
        m = requests.post(
            f"{API}/verses/match",
            json={"problem": "I feel lonely"},
            headers=_auth(token),
            timeout=120,
        ).json()
        match_id = m["id"]

        h = requests.get(f"{API}/history", headers=_auth(token), timeout=15)
        assert h.status_code == 200
        assert any(x["id"] == match_id for x in h.json())

        f = requests.post(f"{API}/favorites", json={"match_id": match_id}, headers=_auth(token), timeout=15)
        assert f.status_code == 200
        favs = requests.get(f"{API}/favorites", headers=_auth(token), timeout=15).json()
        assert any(x["id"] == match_id for x in favs)

        d = requests.delete(f"{API}/favorites/{match_id}", headers=_auth(token), timeout=15)
        assert d.status_code == 200

    def test_premium_context_gated_for_free(self):
        email = f"TEST_it3_ctx_{uuid.uuid4().hex[:8]}@hisword.com"
        u = _signup(email)
        token = u["access_token"]
        m = requests.post(
            f"{API}/verses/match",
            json={"problem": "I need peace"},
            headers=_auth(token),
            timeout=120,
        ).json()
        r = requests.get(f"{API}/verses/{m['id']}/context", headers=_auth(token), timeout=30)
        assert r.status_code == 402

    def test_premium_context_works_for_trial_user(self, trial_user):
        # set user back to active via webhook
        future = int(time.time()) + 7 * 86400
        evt = {
            "id": f"evt_test_{uuid.uuid4().hex[:8]}",
            "type": "customer.subscription.updated",
            "data": {"object": {
                "id": "sub_test_active",
                "status": "active",
                "current_period_end": future,
                "metadata": {"user_id": trial_user["id"]},
                "customer": "cus_test",
                "cancel_at_period_end": False,
            }},
        }
        requests.post(f"{API}/webhook/stripe", json=evt, timeout=15)

        token = trial_user["token"]
        m = requests.post(
            f"{API}/verses/match",
            json={"problem": "I am stressed about work"},
            headers=_auth(token),
            timeout=120,
        )
        assert m.status_code == 200, m.text
        match_id = m.json()["id"]
        r = requests.get(f"{API}/verses/{match_id}/context", headers=_auth(token), timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "reference" in body and "context_text" in body

    def test_tts_generate(self):
        email = f"TEST_it3_tts_{uuid.uuid4().hex[:8]}@hisword.com"
        u = _signup(email)
        token = u["access_token"]
        r = requests.post(
            f"{API}/tts/generate",
            json={"text": "Be still and know that I am God."},
            headers=_auth(token),
            timeout=60,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("mime_type") == "audio/mpeg"
        assert body.get("audio_base64") and len(body["audio_base64"]) > 1000
