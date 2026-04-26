# His Word — Product Requirements

## Vision
A spiritually-uplifting Bible verse companion mobile app. Users describe what's on their heart, and the app responds with a fitting verse (NIV or KJV), an empathetic explanation, and an optional voice reading.

## Tech Stack
- **Frontend**: Expo (React Native) + expo-router + TypeScript, Cormorant Garamond + Outfit, lucide-react-native
- **Backend**: FastAPI + MongoDB (motor)
- **AI**: Claude Sonnet 4.5 via emergentintegrations (verse matching, daily verse, surrounding context)
- **Voice**: ElevenLabs TTS — voice "David, British Radio Host & Storyteller" (`5gLuKtB16QIQv1vuSas1`), eleven_multilingual_v2
- **Auth**: JWT (PyJWT + bcrypt), tokens in SecureStore (native) / localStorage (web)
- **Payments**: **Real Stripe subscriptions** (user's own Stripe account) using official `stripe` Python SDK with `mode=subscription`, `trial_period_days=7`, automatic monthly auto-renewal

## Pricing & Access
- **Free tier**: 3 lifetime verse matches
- **Paywall**: card required — single CTA "Start 7-day free trial" → real Stripe Checkout (subscription mode)
- **Day 0**: card captured, $0 charged, user enters trial state
- **Day 8**: Stripe automatically charges $4.99 and starts the active subscription
- **Each month thereafter**: Stripe automatically charges $4.99 and renews
- **Cancel anytime**: Settings → Manage subscription opens Stripe Customer Portal (built-in cancel/update card/invoice history UI)
- **Premium unlocks**: unlimited verse matches, "Read more context" surrounding verses, all save/share/voice features

## Stripe Integration Details
- Product + recurring price auto-created on first checkout (idempotent via `lookup_key=his_word_premium_monthly_499`); cached `price_id` in `db.stripe_config`
- One Stripe Customer per user, stored in `users.stripe_customer_id`
- Webhook endpoint `POST /api/webhook/stripe` listens for: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.paid`, `invoice.payment_failed` — mirrors Stripe state onto `users.subscription_status` + `current_period_end` + `cancel_at_period_end`
- `STRIPE_WEBHOOK_SECRET` optional; when set, signature is verified

## Features
1. Email/password sign-up (free)
2. Home: prompt + 5 quick-tap chips (fear of being alone, financial stress, low self-esteem, depression, questioning everything) → AI matches a verse + reflection
3. Voice playback (David, British storyteller)
4. Save favorites + history
5. Share verse via native share / Web Share API / clipboard fallback
6. Read more context (premium) — surrounding 6-10 verses via Claude
7. Bible translation toggle: NIV / KJV
8. Daily verse + opt-in 8 AM daily notification
9. Settings: profile, subscription card with auto-renew status, translation, daily reminder, sign out, **Manage subscription** (Stripe Portal)

## API Routes (`/api`)
- Auth: `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- Settings: `PATCH /settings/translation` `{translation: 'NIV'|'KJV'}`
- Verses: `POST /verses/match` `{problem}`, `GET /verses/{id}/context` (premium)
- History: `GET /history`
- Favorites: `POST /favorites`, `GET /favorites`, `DELETE /favorites/{match_id}`
- Voice: `POST /tts/generate` `{text}` → base64 mp3
- Daily verse: `GET /daily-verse`
- Subscription: `POST /subscription/checkout` `{origin_url}`, `GET /subscription/status/{session_id}`, `POST /subscription/portal` `{origin_url}`, `POST /webhook/stripe`

## Mongo Collections
`users` (subscription fields), `verse_matches`, `favorites`, `daily_verses`, `payment_transactions`, `stripe_config`
