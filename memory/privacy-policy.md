# Privacy Policy

**Verse for That**  
*Last updated: April 27, 2026*  
*Effective date: April 27, 2026*

---

## Introduction

This Privacy Policy explains how **Verse for That** ("we," "us," "our," or "the App") — a mobile application owned and operated by Wendy Ardolino — collects, uses, stores, and protects information about you when you use the App.

We built Verse for That to be a quiet, judgment-free space. We collect only what we need to make the App work, and we do not sell, rent, or share your personal information with advertisers. Ever.

If you have any questions about this policy, contact us at **tapworksapp@gmail.com**.

---

## 1. Information we collect

### 1.1 Information you provide directly

When you create an account or use the App, you may provide:

- **Account information** — your email address, a password (which we hash using bcrypt and never store in plain text), and an optional display name.
- **Bible translation preference** — your choice between the King James Version (KJV) or the New International Version (NIV).
- **Problems / struggles you describe** — the free-text or voice-dictated description of what you are going through that you submit in order to receive a matching Bible verse.
- **Voice recordings** — if you choose to use the "Speak instead" microphone feature, an audio recording of your voice is captured on your device and sent to our backend for transcription. **The audio file itself is not retained**: it is forwarded to ElevenLabs for speech-to-text conversion, and only the resulting text is saved as part of your problem history.
- **Notes and voice memos** — text notes and voice memos you create in the Notes tab. Voice memos are stored as base64-encoded audio inside our database, associated with your account.
- **Saved (favorited) verses** — references to verses you save for later.

### 1.2 Information collected automatically

We collect a small amount of operational information automatically:

- **Authentication tokens** (JSON Web Tokens) — stored locally on your device in the platform secure store (iOS Keychain / Android Keystore) so you can stay signed in.
- **App preferences** — such as your daily-verse reminder setting, accessibility preferences (high contrast, auto-play voice, larger text, reduced motion), and splash-sound mute preference. These are stored locally on your device.
- **History** — each time we generate a verse for you, we record the date, the original problem text, the matched verse reference, and the accompanying explanation, so you can revisit it later from the History tab.

### 1.3 What we do **not** collect

- We do **not** collect your contacts, photo library, location, calendar, or health data.
- We do **not** use third-party analytics, crash-reporting, or advertising SDKs.
- We do **not** track you across other apps or websites.
- We do **not** use cookies in the App.

---

## 2. How we use your information

We use the information we collect solely to operate the App, including to:

- Authenticate you and keep you signed in.
- Match a Bible verse to the problem you describe by sending the text of your problem to our backend, which uses **Anthropic's Claude** large-language model to identify a relevant verse, write a brief reflection, and (on request) provide deeper explanation or related verses.
- Read verses aloud through **ElevenLabs** text-to-speech using the "David – British storyteller" voice.
- Generate the soft ambient sound played when you open the App, using **ElevenLabs Sound Effects**.
- Transcribe your voice input using **ElevenLabs Speech-to-Text** when you tap "Speak instead".
- Store your saved verses, history, and notes for your personal use.
- Schedule and deliver an optional daily-verse reminder notification at 8:00 AM local time.
- Communicate with you about your account when necessary (e.g. password resets).

We do not perform any automated decision-making, profiling, or scoring of your personal information.

---

## 3. Third-party services

The App relies on a small number of third parties to function. We share only the data necessary for each service to perform its function. We do not authorize them to use your data for their own purposes beyond what is required to deliver the service to us.

| Service | What is sent | Purpose | Provider's policy |
|---|---|---|---|
| **Anthropic (Claude)** | The text of the problem you submit | Verse matching, reflection, deeper explanation, related verses | https://www.anthropic.com/legal/privacy |
| **ElevenLabs (TTS)** | The verse text + reference | Synthesizes audio narration | https://elevenlabs.io/privacy-policy |
| **ElevenLabs (Sound Effects)** | A fixed prompt (no personal data) | Generates ambient app-open sound | (same as above) |
| **ElevenLabs (Speech-to-Text)** | The audio bytes you record | Transcribes your voice into text | (same as above) |
| **MongoDB Atlas** (hosting) | Encrypted account, history, saved-verse, and notes data | Database storage | https://www.mongodb.com/legal/privacy/privacy-policy |
| **Apple App Store / Google Play** | Purchase confirmation | Distribution and one-time purchase processing | https://www.apple.com/legal/privacy/ ; https://policies.google.com/privacy |
| **Expo / EAS** (build infrastructure) | Build artifacts only — no user data | App build & over-the-air updates | https://expo.dev/privacy |

We do not sell your data to any of these providers, and they do not pay us for it.

---

## 4. Where your data is stored

- **On your device:** authentication tokens, accessibility and preference settings, and cached audio for the splash sound are stored locally using Expo SecureStore (which uses iOS Keychain or Android Keystore) and the device file system.
- **On our servers:** account information, problem history, saved verses, and notes are stored in a MongoDB database hosted in the United States. The connection between the App and our backend is encrypted in transit using HTTPS / TLS.

We retain your account and associated data for as long as your account is active. You may delete your account at any time (see Section 7).

---

## 5. Security

We protect your information using a combination of:

- **HTTPS / TLS** for all network traffic between the App and our backend.
- **Bcrypt password hashing** — your password is never stored in plain text and is not visible to us.
- **JWT bearer tokens** stored in your device's secure enclave (Keychain / Keystore).
- Backend access controls limiting who on our team can view stored data.

No system is 100% secure. We cannot guarantee absolute security, but we work hard to safeguard the information you entrust to us.

---

## 6. Children's privacy

Verse for That is intended for users aged 4 and older. We do not knowingly collect personal information from children under the age of 13 (or the equivalent minimum age in the relevant jurisdiction) without verifiable parental consent. If you believe a child has provided us with personal information without consent, please contact us at **tapworksapp@gmail.com** and we will promptly delete it.

---

## 7. Your rights and choices

Depending on your location, you may have the following rights:

- **Access** — request a copy of the personal information we hold about you.
- **Correction** — ask us to correct inaccurate information.
- **Deletion** — ask us to delete your account and all associated personal data. To do so, email **tapworksapp@gmail.com** from the email address on your account, or use the in-app "Sign out" button followed by an account-deletion request.
- **Data portability** — request a machine-readable export of your account data.
- **Objection / restriction** — ask us to stop or limit certain uses of your data.
- **Withdraw consent** — for processing that relies on consent (e.g. notifications, voice transcription), you may withdraw consent at any time by changing the relevant setting in the App or revoking permissions in your device settings.

For California residents, these rights are also granted under the **California Consumer Privacy Act (CCPA)**. We do not sell or share your personal information for cross-context behavioral advertising.

For residents of the European Economic Area, United Kingdom, and Switzerland, we process your personal data under the legal bases of (a) performance of a contract (account features), (b) consent (notifications, voice transcription), and (c) our legitimate interests in operating and improving the App. You also have the right to lodge a complaint with your local data-protection authority.

We will respond to verifiable requests within 30 days (or the shortest period required by your local law).

---

## 8. International data transfers

If you are using the App from outside the United States, please be aware that your information may be transferred to, stored, and processed in the United States, where our servers and several of our service providers are located. By using the App, you consent to that transfer.

---

## 9. Permissions we request on your device

| Permission | Why |
|---|---|
| **Microphone** | Only used when you tap "Speak instead" to dictate your problem, or when you record a voice memo in the Notes tab. We never record passively. |
| **Notifications** | Only used to send the optional daily 8:00 AM verse reminder. You may disable this anytime in App Settings or device Settings. |

You may decline or revoke either permission at any time without losing access to the rest of the App.

---

## 10. Bible content & copyright

- The **King James Version (KJV)** is in the public domain.
- Quotations from the **New International Version (NIV)** are used by permission and are limited to brief excerpts that fall within fair-use principles. NIV © Biblica, Inc.® Used by permission. All rights reserved worldwide.

---

## 11. Changes to this policy

We may update this Privacy Policy from time to time to reflect changes in our practices or applicable law. When we do, we will revise the "Last updated" date at the top of this document and, if the changes are material, we will notify you in-app prior to the changes taking effect. Continuing to use the App after the new policy takes effect constitutes acceptance.

---

## 12. Contact

If you have questions, requests, or complaints about this Privacy Policy or our handling of your personal information, please contact:

**Verse for That**  
Wendy Ardolino  
Email: **tapworksapp@gmail.com**

---

*Verse for That is an independent app and is not affiliated with, endorsed by, or sponsored by Anthropic, ElevenLabs, MongoDB, Apple, Google, Biblica, or any church or religious organization.*
