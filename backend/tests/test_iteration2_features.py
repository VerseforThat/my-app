"""Iteration 2: tests for translation, free-quota, trial, checkout, context, webhook."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://verse-match-5.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _signup(session, email=None):
    email = email or f"test_it2_{uuid.uuid4().hex[:10]}@hisword.com"
    r = session.post(f"{API}/auth/signup", json={"email": email, "password": "faith1234", "name": "It2"})
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    return {"email": email, "token": data["access_token"], "user": data["user"]}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def free_user(session):
    """Brand new free user; verses_used=0."""
    u = _signup(session)
    return u


@pytest.fixture(scope="module")
def trial_user(session):
    """Brand new user; will start trial during tests."""
    u = _signup(session)
    return u


@pytest.fixture
def free_headers(free_user):
    return {"Authorization": f"Bearer {free_user['token']}", "Content-Type": "application/json"}


@pytest.fixture
def trial_headers(trial_user):
    return {"Authorization": f"Bearer {trial_user['token']}", "Content-Type": "application/json"}


# ---------------- /api/auth/me new fields ----------------
class TestAuthMeFields:
    def test_me_has_iteration2_fields(self, session, free_headers):
        r = session.get(f"{API}/auth/me", headers=free_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("bible_translation", "verses_used", "free_verses_remaining",
                  "subscription_status", "is_premium"):
            assert k in d, f"missing {k}"
        assert d["bible_translation"] == "NIV"
        assert d["verses_used"] == 0
        assert d["free_verses_remaining"] == 3
        assert d["subscription_status"] == "free"
        assert d["is_premium"] is False


# ---------------- /api/settings/translation ----------------
class TestTranslationSettings:
    def test_set_kjv(self, session, free_headers):
        r = session.patch(f"{API}/settings/translation",
                          headers=free_headers,
                          json={"translation": "KJV"})
        assert r.status_code == 200, r.text
        assert r.json()["bible_translation"] == "KJV"
        # Verify persisted
        me = session.get(f"{API}/auth/me", headers=free_headers).json()
        assert me["bible_translation"] == "KJV"

    def test_set_back_niv(self, session, free_headers):
        r = session.patch(f"{API}/settings/translation",
                          headers=free_headers,
                          json={"translation": "NIV"})
        assert r.status_code == 200
        assert r.json()["bible_translation"] == "NIV"

    def test_invalid_translation_422(self, session, free_headers):
        r = session.patch(f"{API}/settings/translation",
                          headers=free_headers,
                          json={"translation": "ESV"})
        assert r.status_code == 422


# ---------------- Free quota & paywall ----------------
class TestFreeQuota:
    """Use 3 free verses, 4th must 402 with detail.error='free_limit_reached'."""

    @pytest.fixture(scope="class")
    def quota_user(self, session):
        return _signup(session)

    @pytest.fixture
    def quota_headers(self, quota_user):
        return {"Authorization": f"Bearer {quota_user['token']}", "Content-Type": "application/json"}

    def test_use_three_free_verses(self, session, quota_headers):
        prompts = ["I am anxious", "I feel lonely", "I am afraid"]
        for i, p in enumerate(prompts, 1):
            r = session.post(f"{API}/verses/match", headers=quota_headers,
                             json={"problem": p}, timeout=90)
            assert r.status_code == 200, f"verse {i} failed: {r.status_code} {r.text}"
        me = session.get(f"{API}/auth/me", headers=quota_headers).json()
        assert me["verses_used"] == 3
        assert me["free_verses_remaining"] == 0

    def test_fourth_returns_402(self, session, quota_headers):
        r = session.post(f"{API}/verses/match", headers=quota_headers,
                         json={"problem": "I doubt everything"}, timeout=90)
        assert r.status_code == 402, f"expected 402 got {r.status_code} {r.text}"
        body = r.json()
        # FastAPI wraps custom detail in {"detail": {...}}
        detail = body.get("detail", body)
        assert detail.get("error") == "free_limit_reached"


# ---------------- Trial ----------------
class TestTrial:
    def test_start_trial_success(self, session, trial_headers):
        r = session.post(f"{API}/subscription/start-trial", headers=trial_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["subscription_status"] == "trialing"
        assert d["is_premium"] is True
        assert d["current_period_end"]

    def test_start_trial_twice_rejected(self, session, trial_headers):
        r = session.post(f"{API}/subscription/start-trial", headers=trial_headers)
        assert r.status_code == 400

    def test_match_works_after_trial(self, session, trial_headers):
        # User on trial should match verses without hitting quota
        r = session.post(f"{API}/verses/match", headers=trial_headers,
                         json={"problem": "Help me trust God's plan"}, timeout=90)
        assert r.status_code == 200, r.text
        match_id = r.json()["id"]
        TestTrial.match_id = match_id

    def test_context_for_premium(self, session, trial_headers):
        match_id = getattr(TestTrial, "match_id", None)
        assert match_id, "no match id from previous test"
        r = session.get(f"{API}/verses/{match_id}/context", headers=trial_headers, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["reference"]
        assert d["context_text"]


# ---------------- Premium-gated context for free user ----------------
class TestContextGating:
    def test_context_blocked_for_free_user(self, session, free_user):
        # Free user creates a match (their first; under limit since free_user has 0 used originally;
        # but TestAuthMeFields didn't consume verses. However other tests in this class use free_user.)
        # Use a fresh user to be safe.
        u = _signup(session)
        h = {"Authorization": f"Bearer {u['token']}", "Content-Type": "application/json"}
        r = session.post(f"{API}/verses/match", headers=h,
                         json={"problem": "I feel lost"}, timeout=90)
        assert r.status_code == 200, r.text
        mid = r.json()["id"]
        # Now request context as a still-free user
        r2 = session.get(f"{API}/verses/{mid}/context", headers=h)
        assert r2.status_code == 402, r2.text
        detail = r2.json().get("detail", {})
        if isinstance(detail, dict):
            assert detail.get("error") == "premium_required"


# ---------------- Stripe checkout ----------------
class TestCheckout:
    def test_create_checkout_returns_url_and_session(self, session, trial_headers):
        r = session.post(f"{API}/subscription/checkout",
                         headers=trial_headers,
                         json={"origin_url": "https://verse-match-5.preview.emergentagent.com"},
                         timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "url" in d and "session_id" in d
        assert d["session_id"].startswith("cs_"), d["session_id"]
        # checkout url should include stripe.com
        assert "stripe.com" in d["url"], d["url"]
        TestCheckout.session_id = d["session_id"]

    def test_status_endpoint(self, session, trial_headers):
        sid = getattr(TestCheckout, "session_id", None)
        assert sid
        r = session.get(f"{API}/subscription/status/{sid}", headers=trial_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "payment_status" in d  # likely "unpaid" since not actually paid
        assert "user" in d

    def test_status_unknown_session_404(self, session, trial_headers):
        r = session.get(f"{API}/subscription/status/cs_doesnotexist", headers=trial_headers)
        assert r.status_code == 404


# ---------------- Webhook ----------------
class TestWebhook:
    def test_webhook_invalid_signature_returns_400(self, session):
        r = session.post(f"{API}/webhook/stripe",
                         headers={"Content-Type": "application/json", "Stripe-Signature": "t=1,v1=bad"},
                         data=b'{"id":"evt_test","type":"checkout.session.completed"}')
        # Either 400 (sig fail) is acceptable; some impls 200 — spec says 400
        assert r.status_code in (400, 422), r.text

    def test_webhook_no_signature_returns_400(self, session):
        r = session.post(f"{API}/webhook/stripe",
                         headers={"Content-Type": "application/json"},
                         data=b'{"id":"evt_test"}')
        assert r.status_code in (400, 422), r.text
