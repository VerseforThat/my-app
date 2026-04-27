import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { getItem, setItem } from './storage';
import { colors as defaultColors, highContrastColors, getColors } from './theme';

// Persisted user prefs override the OS default. `null` means "follow system".
type Tri = 'on' | 'off' | null;

const KEY_HIGH_CONTRAST = 'a11y_high_contrast';
const KEY_AUTO_PLAY = 'a11y_auto_play_voice';
const KEY_LARGER_TEXT = 'a11y_larger_text';
const KEY_REDUCED_MOTION = 'a11y_reduced_motion';

const FONT_SCALE_BUMP = 1.15; // +15% on top of system scale when Larger Text is on

type Ctx = {
  // effective values (user pref || system default)
  highContrast: boolean;
  autoPlayVoice: boolean;
  largerText: boolean;
  reducedMotion: boolean;
  screenReaderEnabled: boolean;

  // setters (set user pref, persisted)
  setHighContrast: (v: boolean) => Promise<void>;
  setAutoPlayVoice: (v: boolean) => Promise<void>;
  setLargerText: (v: boolean) => Promise<void>;
  setReducedMotion: (v: boolean) => Promise<void>;

  // derived helpers
  colors: typeof defaultColors;
  fontScale: number; // multiplier to apply to fixed font sizes (1 or 1.15)
  scaleFont: (size: number) => number;
};

const AccessibilityCtx = createContext<Ctx | null>(null);

async function loadTri(key: string): Promise<Tri> {
  try {
    const v = await getItem(key);
    if (v === '1') return 'on';
    if (v === '0') return 'off';
    return null;
  } catch {
    return null;
  }
}

async function saveTri(key: string, value: boolean) {
  try {
    await setItem(key, value ? '1' : '0');
  } catch {}
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  // Persisted user prefs (null = follow system)
  const [highContrastPref, setHighContrastPref] = useState<Tri>(null);
  const [autoPlayPref, setAutoPlayPref] = useState<Tri>(null);
  const [largerTextPref, setLargerTextPref] = useState<Tri>(null);
  const [reducedMotionPref, setReducedMotionPref] = useState<Tri>(null);

  // System accessibility flags
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);

  // Hydrate user prefs once
  useEffect(() => {
    (async () => {
      const [hc, ap, lt, rm] = await Promise.all([
        loadTri(KEY_HIGH_CONTRAST),
        loadTri(KEY_AUTO_PLAY),
        loadTri(KEY_LARGER_TEXT),
        loadTri(KEY_REDUCED_MOTION),
      ]);
      setHighContrastPref(hc);
      setAutoPlayPref(ap);
      setLargerTextPref(lt);
      setReducedMotionPref(rm);
    })();
  }, []);

  // System flags + listeners
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [rm, sr] = await Promise.all([
          AccessibilityInfo.isReduceMotionEnabled?.() ?? Promise.resolve(false),
          AccessibilityInfo.isScreenReaderEnabled(),
        ]);
        if (!mounted) return;
        setSystemReducedMotion(!!rm);
        setScreenReaderEnabled(!!sr);
      } catch {}
    })();

    const subs: Array<{ remove: () => void } | undefined> = [];
    try {
      subs.push(
        AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
          setSystemReducedMotion(!!v);
        })
      );
    } catch {}
    try {
      subs.push(
        AccessibilityInfo.addEventListener('screenReaderChanged', (v: boolean) => {
          setScreenReaderEnabled(!!v);
        })
      );
    } catch {}

    return () => {
      mounted = false;
      subs.forEach((s) => s && s.remove?.());
    };
  }, []);

  // Effective values: user pref overrides system; default for unset is system or false.
  const highContrast = highContrastPref === 'on';
  const largerText = largerTextPref === 'on';
  // Reduced motion: user pref wins; otherwise follow system.
  const reducedMotion =
    reducedMotionPref === null ? systemReducedMotion : reducedMotionPref === 'on';
  // Auto play voice: user pref wins; otherwise default ON if a screen reader is detected.
  const autoPlayVoice =
    autoPlayPref === null ? screenReaderEnabled : autoPlayPref === 'on';

  const fontScale = largerText ? FONT_SCALE_BUMP : 1;
  const scaleFont = (size: number) => Math.round(size * fontScale * 10) / 10;

  const value: Ctx = useMemo(
    () => ({
      highContrast,
      autoPlayVoice,
      largerText,
      reducedMotion,
      screenReaderEnabled,
      setHighContrast: async (v) => {
        setHighContrastPref(v ? 'on' : 'off');
        await saveTri(KEY_HIGH_CONTRAST, v);
      },
      setAutoPlayVoice: async (v) => {
        setAutoPlayPref(v ? 'on' : 'off');
        await saveTri(KEY_AUTO_PLAY, v);
      },
      setLargerText: async (v) => {
        setLargerTextPref(v ? 'on' : 'off');
        await saveTri(KEY_LARGER_TEXT, v);
      },
      setReducedMotion: async (v) => {
        setReducedMotionPref(v ? 'on' : 'off');
        await saveTri(KEY_REDUCED_MOTION, v);
      },
      colors: getColors(highContrast),
      fontScale,
      scaleFont,
    }),
    [highContrast, autoPlayVoice, largerText, reducedMotion, screenReaderEnabled, fontScale]
  );

  return <AccessibilityCtx.Provider value={value}>{children}</AccessibilityCtx.Provider>;
}

export function useAccessibility(): Ctx {
  const ctx = useContext(AccessibilityCtx);
  if (!ctx) {
    // Safe default during very-early render before provider mounts.
    return {
      highContrast: false,
      autoPlayVoice: false,
      largerText: false,
      reducedMotion: false,
      screenReaderEnabled: false,
      setHighContrast: async () => {},
      setAutoPlayVoice: async () => {},
      setLargerText: async () => {},
      setReducedMotion: async () => {},
      colors: defaultColors,
      fontScale: 1,
      scaleFont: (s) => s,
    };
  }
  return ctx;
}

// Convenience: return only the active palette (default or high-contrast).
export function useColors() {
  return useAccessibility().colors;
}

// Convenience: return only the font multiplier and scaler.
export function useFontScale() {
  const { fontScale, scaleFont } = useAccessibility();
  return { fontScale, scaleFont };
}

// Suppress unused-var warnings for re-exports
export { highContrastColors };
