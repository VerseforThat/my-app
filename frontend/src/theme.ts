/**
 * Verse for That — Design Tokens
 * --------------------------------
 * Single source of truth for ALL colors, typography, spacing and radii.
 * Every screen imports from here — never hardcode color values in components.
 *
 * Two palettes live here:
 *  • `colors.*`        — the calm, cream/forest/clay palette used across the
 *                        whole app (home, search, saved, history, settings,
 *                        login, signup, etc.).  Derived from the home screen.
 *  • `colors.splash.*` — the cinematic gold / navy palette used ONLY on the
 *                        animated welcome splash screen.
 *
 * If you find yourself reaching for a raw hex value in a component, add a
 * named token here first, then reference it.
 */

// ---------------------------------------------------------------------------
// Raw palette — internal. Do NOT import these directly from screens.
// Use the semantic `colors.*` aliases below so the palette can evolve without
// rippling through every file.
// ---------------------------------------------------------------------------
const palette = {
  // Home / app palette
  cream: '#FAF9F6',
  parchment: '#F4F1EA',
  white: '#FFFFFF',
  forest: '#2D3A30',
  sage: '#717C73',
  fog: '#A6AEA7',
  clay: '#A88D7D',
  clayDeep: '#8C7364',
  moss: '#4A6150',
  rose: '#B06A6A',

  // Splash cinematic palette
  navyDeep: '#080F1F',
  navy: '#0B1426',
  indigo: '#1A1B36',
  amberShadow: '#3B2E2A',
  amber: '#7E5E22',
  gold: '#C49234',
  goldBright: '#F2C24F',
  goldGlow: '#FFE7A8',
  goldHalo: '#F6CE6E',
  cloudShadow: '#040813',
  particle: '#FFF1B8',
} as const;

// ---------------------------------------------------------------------------
// Semantic colors — what screens actually consume.
// ---------------------------------------------------------------------------
export const colors = {
  // Surfaces
  bg: palette.cream,
  surface: palette.parchment,
  surfaceElevated: palette.white,

  // Text
  textPrimary: palette.forest,
  textSecondary: palette.sage,
  textDisabled: palette.fog,
  textOnDark: palette.white,

  // Brand & interactive
  accent: palette.clay,
  accentHover: palette.clayDeep,
  interactive: palette.moss,
  error: palette.rose,

  // Lines & dividers
  border: 'rgba(45, 58, 48, 0.08)',
  borderStrong: 'rgba(45, 58, 48, 0.18)',

  // Overlays (used for vignettes & subtle scrims)
  overlayLight: 'rgba(0, 0, 0, 0.25)',
  overlayMedium: 'rgba(0, 0, 0, 0.4)',
  overlayHeavy: 'rgba(0, 0, 0, 0.45)',

  // Splash / cinematic — sub-namespaced so it can't bleed into normal screens.
  splash: {
    bgFallback: palette.navy,
    cloudShadow: palette.cloudShadow,
    particle: palette.particle,
    particleGlow: palette.goldGlow,

    appName: palette.goldBright,
    appNameGlow: 'rgba(255, 210, 120, 0.35)',

    headlineText: palette.white,
    subText: 'rgba(255, 255, 255, 0.92)',
    headlineShadow: 'rgba(0, 0, 0, 0.45)',
    subShadow: 'rgba(0, 0, 0, 0.4)',

    buttonBg: palette.white,
    buttonText: palette.navy,
    buttonGlow: 'rgba(255, 255, 255, 0.35)',
    buttonShadow: palette.white,

    // Vertical gradient stops, dark-bottom → gold-top
    gradient: [
      palette.navyDeep,
      palette.navy,
      palette.indigo,
      palette.amberShadow,
      palette.amber,
      palette.gold,
      palette.goldBright,
    ] as readonly string[],
    gradientLocations: [0, 0.18, 0.38, 0.55, 0.74, 0.88, 1] as readonly number[],

    // Sun-glow radial stops (color, opacity)
    sunGlow: [
      { color: palette.goldGlow, opacity: 0.95, offset: '0%' },
      { color: palette.goldHalo, opacity: 0.55, offset: '35%' },
      { color: palette.amber, opacity: 0.18, offset: '65%' },
      { color: palette.navy, opacity: 0, offset: '100%' },
    ] as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Typography — Cormorant Garamond serif + Outfit sans.
// ---------------------------------------------------------------------------
export const fonts = {
  serif: 'CormorantGaramond_500Medium',
  serifBold: 'CormorantGaramond_600SemiBold',
  sans: 'Outfit_400Regular',
  sansMedium: 'Outfit_500Medium',
  sansSemi: 'Outfit_600SemiBold',
} as const;

// ---------------------------------------------------------------------------
// Border radii — semantic shapes.
// ---------------------------------------------------------------------------
export const radii = {
  pill: 999,
  card: 24,
  input: 18,
  chip: 999,
} as const;

// ---------------------------------------------------------------------------
// 4-pt spacing scale (use spacing(2) = 8, spacing(4) = 16, spacing(6) = 24…)
// ---------------------------------------------------------------------------
export const spacing = (n: number) => n * 4;

// ---------------------------------------------------------------------------
// Reusable elevation presets (web fallback uses `boxShadow` automatically).
// ---------------------------------------------------------------------------
export const shadows = {
  none: {},
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  button: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
} as const;

// Convenience export so consumers can do `import { theme } from '../src/theme'`.
export const theme = { colors, fonts, radii, spacing, shadows } as const;
export type Theme = typeof theme;
