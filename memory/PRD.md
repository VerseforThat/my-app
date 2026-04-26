# His Word — Product Requirements

## Vision
A spiritually-uplifting Bible verse companion mobile app. Users describe what's on their heart, and the app responds with a fitting NIV verse, an empathetic explanation, and an optional voice reading.

## Tech Stack
- **Frontend**: Expo (React Native) with expo-router, TypeScript, lucide-react-native icons, Cormorant Garamond + Outfit Google Fonts
- **Backend**: FastAPI (Python), MongoDB (motor)
- **AI**: Claude Sonnet 4.5 via emergentintegrations (verse matching + explanation, daily verse)
- **Voice**: ElevenLabs TTS (eleven_multilingual_v2, voice "Sarah")
- **Auth**: Custom JWT (PyJWT + bcrypt), tokens stored in SecureStore (native) / localStorage (web)

## Features (v1)
1. Sign up / Login (email + password, free)
2. Home: text input → AI matches a NIV verse + empathetic explanation
3. Voice playback of verse + explanation (ElevenLabs)
4. Save verses to favorites
5. History of past prayers and verses
6. Daily verse (cached per UTC day)
7. Daily verse local notification (8 AM, opt-in)
8. Settings (profile, translation info, sign out)

## Design
- Organic & Earthy palette: bone-white #FAF9F6, warm sand #F4F1EA, deep olive #2D3A30, rosewood accent #A88D7D
- Cormorant Garamond serif for verses & headings; Outfit sans for UI
- Generous spacing, gentle micro-interactions (pulsing ring on play), no purple gradients

## API Routes (`/api`)
- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- `POST /verses/match` (auth) — body `{problem}`
- `GET /history` (auth)
- `POST /favorites` (auth) `{match_id}`, `GET /favorites`, `DELETE /favorites/{match_id}`
- `POST /tts/generate` (auth) `{text}` → base64 mp3
- `GET /daily-verse` (public, cached per UTC day)

## Mongo Collections
`users`, `verse_matches`, `favorites`, `daily_verses`
