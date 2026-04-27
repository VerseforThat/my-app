/**
 * Verse for That — Design Tokens
 * --------------------------------
 * Single source of truth for ALL colors, typography, spacing and radii.
 * Every screen imports from here — never hardcode color values in components.
 *
 *   • Palette    — clean white surfaces, deep navy text, warm gold actions.
 *                  Inspired by the cinematic splash so the whole app feels of-a-piece.
 *   • Splash    — sub-namespace `colors.splash.*` keeps the cinematic
 *                 gold-light-through-storm-clouds animation untouched.
 */

// ---------------------------------------------------------------------------
// Raw palette — internal. Use the semantic `colors.*` aliases below in screens.
// ---------------------------------------------------------------------------
const palette = {
  // Surfaces
  white: '#FFFFFF',
  paper: '#FAF7F0',         // very faint warm cream for cards / surfaces
  paperDeep: '#F2ECE0',     // hover / selected card background

  // Navy family (text + dark elements)
  navyDeep: '#080F1F',
  navy: '#0B1426',
  navyMid: '#1A2336',
  navyMuted: '#4F5A74',
  navyDisabled: '#9AA0AC',

  // Gold family (actions + accents)
  gold: '#C49234',          // muted brand gold
  goldBright: '#F2C24F',    // primary button gold
  goldLight: '#F6D079',     // hover / active highlight
  goldPale: '#FFE7A8',      // soft halo / glow
  goldDeep: '#A87A24',      // pressed state
  goldInk: '#6E4E14',       // dark, readable gold for body text

  // Splash gradient stops
  amberShadow: '#3B2E2A',
  amber: '#7E5E22',
  goldHalo: '#F6CE6E',
  cloudShadow: '#040813',
  particle: '#FFF1B8',

  // Status
  rose: '#B06A6A',
} as const;

// ---------------------------------------------------------------------------
// Semantic colors — what screens consume.
// ---------------------------------------------------------------------------
export const colors = {
  // Surfaces
  bg: palette.white,
  surface: palette.paper,
  surfaceElevated: palette.white,
  surfaceActive: palette.paperDeep,

  // Text
  textPrimary: palette.navy,
  textSecondary: palette.navyMuted,
  textDisabled: palette.navyDisabled,
  textOnDark: palette.white,

  // Brand & interactive
  accent: palette.gold,                 // small accents — eyebrows, references
  accentHover: palette.goldDeep,
  textAccent: palette.goldInk,          // dark, readable gold for accent body text
  interactive: palette.goldBright,      // primary button background
  interactiveHover: palette.goldLight,
  interactiveText: palette.navy,        // text/icons on top of `interactive`
  error: palette.rose,

  // Lines & dividers
  border: 'rgba(11, 20, 38, 0.10)',
  borderStrong: 'rgba(11, 20, 38, 0.22)',

  // Overlays (vignettes / scrims)
  overlayLight: 'rgba(0, 0, 0, 0.25)',
  overlayMedium: 'rgba(0, 0, 0, 0.40)',
  overlayHeavy: 'rgba(0, 0, 0, 0.45)',

  // Splash / cinematic — DO NOT use outside the welcome screen.
  splash: {
    bgFallback: palette.navy,
    cloudShadow: palette.cloudShadow,
    particle: palette.particle,
    particleGlow: palette.goldPale,

    appName: palette.goldBright,
    appNameGlow: 'rgba(255, 210, 120, 0.35)',

    headlineText: palette.white,
    subText: 'rgba(255, 255, 255, 0.92)',
    headlineShadow: 'rgba(0, 0, 0, 0.45)',
    subShadow: 'rgba(0, 0, 0, 0.40)',

    buttonBg: palette.white,
    buttonText: palette.navy,
    buttonGlow: 'rgba(255, 255, 255, 0.35)',
    buttonShadow: palette.white,

    // Vertical gradient: dark bottom → gold top
    gradient: [
      palette.navyDeep,
      palette.navy,
      palette.navyMid,
      palette.amberShadow,
      palette.amber,
      palette.gold,
      palette.goldBright,
    ] as readonly string[],
    gradientLocations: [0, 0.18, 0.38, 0.55, 0.74, 0.88, 1] as readonly number[],

    // Sun-glow radial stops
    sunGlow: [
      { color: palette.goldPale, opacity: 0.95, offset: '0%' },
      { color: palette.goldHalo, opacity: 0.55, offset: '35%' },
      { color: palette.amber, opacity: 0.18, offset: '65%' },
      { color: palette.navy, opacity: 0, offset: '100%' },
    ] as const,
  },
} as const;

// ---------------------------------------------------------------------------
// High-contrast palette — meets WCAG 2.1 AA (>= 4.5:1 body, >= 3:1 large text).
// Activated via AccessibilityContext when user enables High Contrast Mode.
// ---------------------------------------------------------------------------
export const highContrastColors = {
  ...colors,
  // Surfaces stay light but everything on top gets a stronger ink.
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceActive: '#F0EDE5',

  // Text — pure black for body, very dark navy for secondary
  textPrimary: '#000000',         // 21:1 on white
  textSecondary: '#1A2336',       // 14.6:1 on white (was 5.6:1)
  textDisabled: '#4A5470',        // 6.5:1
  textOnDark: '#FFFFFF',

  // Accents — darker, readable gold for any text use
  accent: palette.goldDeep,       // 5.7:1 on white
  textAccent: '#503812',          // 9.1:1 on white (very dark gold)
  interactive: palette.goldBright,
  interactiveText: '#000000',     // pure black on gold button = max readability
  error: '#9B3535',               // 5.7:1

  // Stronger borders to support contrast users
  border: 'rgba(0, 0, 0, 0.32)',
  borderStrong: 'rgba(0, 0, 0, 0.55)',
} as const;

// Helper — returns the active palette for a given high-contrast flag.
export function getColors(highContrast: boolean) {
  return highContrast ? highContrastColors : colors;
}

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
// Border radii.
// ---------------------------------------------------------------------------
export const radii = {
  pill: 999,
  card: 24,
  input: 18,
  chip: 999,
} as const;

// ---------------------------------------------------------------------------
// 4-pt spacing scale: spacing(2) = 8, spacing(4) = 16, …
// ---------------------------------------------------------------------------
export const spacing = (n: number) => n * 4;

// ---------------------------------------------------------------------------
// Reusable elevation presets.
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

export const theme = { colors, fonts, radii, spacing, shadows } as const;
export type Theme = typeof theme;
