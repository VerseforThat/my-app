// Splash ambient sound powered by ElevenLabs Sound Generation API.
//
// Behavior:
//  • On first launch, ask the backend to generate an ambient tone, save the
//    bytes locally to the device cache, then play immediately.
//  • On subsequent launches, play directly from the cached file (no network).
//  • Fade in slowly over 2 seconds.
//  • Respect the iOS hardware silent switch (playsInSilentModeIOS: false).
//  • Respect the in-app mute toggle (persisted in SecureStore).
//  • Web is a no-op (the welcome screen is primarily a native experience).

import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from './api';
import { getItem, setItem } from './storage';

// ---- Config -------------------------------------------------------------
export const SPLASH_SOUND_PROMPT =
  'A single soft piano note fading into a gentle warm ambient tone, minimal and calming, like the opening of a meditation session, peaceful and therapeutic';

// Generate a longer-than-splash duration so it plays through the full reveal.
const SPLASH_SOUND_DURATION_SECONDS = 12;

const FADE_IN_MS = 2000;
const FADE_STEPS = 20;

const CACHE_FILENAME = 'splash_ambient_v1.mp3';
export const MUTE_PREF_KEY = 'splash_sound_muted';

// ---- State --------------------------------------------------------------
let activeSound: Audio.Sound | null = null;
let fadeTimers: any[] = [];
let stopped = false;

const log = (...args: any[]) => {
  if (__DEV__) {
    try { console.log('[splashSound]', ...args); } catch {}
  }
};

// ---- Helpers ------------------------------------------------------------
const cachedFilePath = () =>
  `${FileSystem.cacheDirectory ?? ''}${CACHE_FILENAME}`;

async function ensureCachedAudio(): Promise<string | null> {
  // Returns local file URI; downloads & caches if missing.
  const path = cachedFilePath();
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists && (info as any).size && (info as any).size > 1000) {
      return path;
    }
  } catch {}

  // Need to fetch from backend.
  try {
    const res = await api.post(
      '/tts/sound-effect',
      {
        text: SPLASH_SOUND_PROMPT,
        duration_seconds: SPLASH_SOUND_DURATION_SECONDS,
        loop: false,
        prompt_influence: 0.4,
      },
      { timeout: 90000 },
    );
    const b64: string | undefined = res.data?.audio_base64;
    if (!b64) return null;
    await FileSystem.writeAsStringAsync(path, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return path;
  } catch (e) {
    // If the network call fails, fail silently — splash should still work.
    console.warn('[splashSound] failed to fetch sound effect', e);
    return null;
  }
}

function clearFadeTimers() {
  for (const t of fadeTimers) {
    try {
      clearTimeout(t);
    } catch {}
  }
  fadeTimers = [];
}

async function fadeIn(sound: Audio.Sound) {
  // Linear ramp 0 → 1 across FADE_IN_MS.
  const stepDur = FADE_IN_MS / FADE_STEPS;
  for (let i = 1; i <= FADE_STEPS; i++) {
    const t = setTimeout(async () => {
      if (stopped) return;
      try {
        await sound.setVolumeAsync(i / FADE_STEPS);
      } catch {}
    }, i * stepDur);
    fadeTimers.push(t);
  }
}

// ---- Public API ---------------------------------------------------------
export async function isMuted(): Promise<boolean> {
  try {
    const v = await getItem(MUTE_PREF_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setMuted(value: boolean): Promise<void> {
  try {
    await setItem(MUTE_PREF_KEY, value ? '1' : '0');
  } catch {}
}

export async function startSplashSound(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (activeSound) {
    log('start: already playing, skipping');
    return;
  }
  if (await isMuted()) {
    log('start: muted, skipping');
    return;
  }

  stopped = false;

  try {
    // Respect iOS silent switch — sound will not play if device is muted.
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch {}

  log('ensuring cached audio…');
  const uri = await ensureCachedAudio();
  if (!uri || stopped) {
    log('no audio uri or stopped — abort');
    return;
  }
  log('have audio at', uri);

  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false, volume: 0, isLooping: false },
    );
    if (stopped) {
      try {
        await sound.unloadAsync();
      } catch {}
      return;
    }
    activeSound = sound;
    await sound.setVolumeAsync(0);
    await sound.playAsync();
    log('playing — fading in');
    fadeIn(sound);
  } catch (e) {
    log('playback failed', e);
  }
}

export async function stopSplashSound(): Promise<void> {
  stopped = true;
  clearFadeTimers();
  const s = activeSound;
  activeSound = null;
  if (s) {
    try {
      await s.stopAsync();
    } catch {}
    try {
      await s.unloadAsync();
    } catch {}
  }
}
