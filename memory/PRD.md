# His Word — Product Requirements

## Vision
A spiritually-uplifting Bible verse companion mobile app. Users describe what's on their heart, and the app responds with a fitting verse (NIV or KJV), an empathetic explanation, and an optional voice reading.

## Tech Stack
- **Frontend**: Expo (React Native) + expo-router + TypeScript, Cormorant Garamond + Outfit, lucide-react-native
- **Backend**: FastAPI + MongoDB (motor)
- **AI**: Claude Sonnet 4.5 via emergentintegrations (verse matching, daily verse, surrounding context)
- **Voice**: ElevenLabs TTS — voice "David, British Radio Host & Storyteller" (`5gLuKtB16QIQv1vuSas1`), eleven_multilingual_v2
- **Auth**: JWT (PyJWT + bcrypt), tokens in SecureStore (native) / localStorage (web)
- **Payments**: Stripe Checkout (test key `sk_test_emergent`) one-time $4.99 charge → grants 30 days premium

## Pricing & Access
- **Free tier**: 3 lifetime verse matches
- **Paywall**: card required — single CTA "Start 7-day free trial · $4.99"
- **First payment**: $4.99 → grants **37 days** of premium (7-day free trial + 30 paid days)
- **Subsequent renewals**: $4.99 → grants **30 days** of premium
- **No auto-renewal**: user manually pays again to extend (Emergent-managed Stripe doesn't support recurring subscriptions)
- **Premium unlocks**: unlimited verse matches, "Read more context" surrounding verses, all save/share/voice features

## Features
1. Email/password sign-up (free)
2. Home: prompt + 5 quick-tap chips (fear of being alone, financial stress, low self-esteem, depression, questioning everything) → AI matches a verse + reflection
3. Voice playback (David, British storyteller)
4. Save favorites + history
5. Share verse via native share / Web Share API / clipboard fallback
6. Read more context (premium) — surrounding 6-10 verses via Claude
7. Bible translation toggle: NIV / KJV
8. Daily verse + opt-in 8 AM daily notification
9. Settings: profile, subscription card, translation, daily reminder, sign out

## API Routes (`/api`)
- Auth: `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- Settings: `PATCH /settings/translation` `{translation: 'NIV'|'KJV'}`
- Verses: `POST /verses/match` `{problem}`, `GET /verses/{id}/context` (premium)
- History: `GET /history`
- Favorites: `POST /favorites` `{match_id}`, `GET /favorites`, `DELETE /favorites/{match_id}`
- Voice: `POST /tts/generate` `{text}` → base64 mp3
- Daily verse: `GET /daily-verse`
- Subscription: `POST /subscription/start-trial`, `POST /subscription/checkout` `{origin_url}`, `GET /subscription/status/{session_id}`, `POST /webhook/stripe`

## Mongo Collections
`users` (with subscription fields), `verse_matches`, `favorites`, `daily_verses`, `payment_transactions`
