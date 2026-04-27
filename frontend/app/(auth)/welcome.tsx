import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Volume2, VolumeX } from 'lucide-react-native';
import Svg, {
  Defs,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { fonts, colors } from '../../src/theme';
import {
  startSplashSound,
  stopSplashSound,
  isMuted,
  setMuted,
} from '../../src/splashSound';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Copy --------------------------------------------------------------------
const HERO_LINE = 'Receive the verse meant for this moment…';
const SUB_LINE = "Quick answers for life's everyday struggles";
const APP_NAME = 'Verse For That';
const CTA_LABEL = "Tell me what you're going through  →";

// Timing ------------------------------------------------------------------
const WORD_DURATION = 320;
const WORD_GAP = 150;
const PAUSE_BETWEEN = 1000;

const HERO_WORDS = HERO_LINE.split(' ');
const SUB_WORDS = SUB_LINE.split(' ');

const HERO_START = 600; // small initial breathing room before first word
const HERO_END = HERO_START + (HERO_WORDS.length - 1) * WORD_GAP + WORD_DURATION;
const SUB_START = HERO_END + PAUSE_BETWEEN;
const SUB_END = SUB_START + (SUB_WORDS.length - 1) * WORD_GAP + WORD_DURATION;
const APP_START = SUB_END + PAUSE_BETWEEN;
const APP_DURATION = 900;
const BUTTON_START = APP_START + APP_DURATION + 200;

// Word ---------------------------------------------------------------------
function FadeWord({ word, delay, style }: { word: string; delay: number; style: any }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: WORD_DURATION, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: WORD_DURATION, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.Text style={[style, animStyle]}>{word + ' '}</Animated.Text>;
}

// Particle -----------------------------------------------------------------
function Particle({
  startX,
  size,
  duration,
  delay,
  driftX,
}: {
  startX: number;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const y = interpolate(
      progress.value,
      [0, 1],
      [SCREEN_H + 30, -40],
      Extrapolation.CLAMP
    );
    const x = startX + Math.sin(progress.value * Math.PI * 2) * driftX;
    const opacity = interpolate(
      progress.value,
      [0, 0.08, 0.85, 1],
      [0, 0.85, 0.55, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX: x }, { translateY: y }],
      opacity,
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

// Cloud --------------------------------------------------------------------
function Cloud({
  top,
  size,
  duration,
  baseX,
  amplitude,
  opacity,
}: {
  top: number;
  size: number;
  duration: number;
  baseX: number;
  amplitude: number;
  opacity: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);
  const style = useAnimatedStyle(() => {
    const x = baseX + (t.value - 0.5) * amplitude * 2;
    return { transform: [{ translateX: x }] };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.cloud,
        {
          top,
          width: size,
          height: size * 0.42,
          borderRadius: size,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Sun glow (animated breathing) -------------------------------------------
function SunGlow() {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 6500, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 + t.value * 0.35,
    transform: [{ scale: 1 + t.value * 0.06 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width={SCREEN_W} height={SCREEN_H}>
        <Defs>
          <SvgRadialGradient
            id="sun"
            cx="50%"
            cy="22%"
            r="55%"
            fx="50%"
            fy="22%"
          >
            {colors.splash.sunGlow.map((s, i) => (
              <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={String(s.opacity)} />
            ))}
          </SvgRadialGradient>
        </Defs>
        <Rect x="0" y="0" width={SCREEN_W} height={SCREEN_H} fill="url(#sun)" />
      </Svg>
    </Animated.View>
  );
}

// Pulsing button -----------------------------------------------------------
function PulsingButton({ onPress }: { onPress: () => void }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);
  const pulse = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      BUTTON_START,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      BUTTON_START,
      withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
    pulse.value = withDelay(
      BUTTON_START + 700,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, []);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: 1 + pulse.value * 0.025 },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.18 }],
  }));

  return (
    <Animated.View style={[styles.btnWrap, wrapStyle]}>
      <Animated.View pointerEvents="none" style={[styles.btnGlow, glowStyle]} />
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        testID="welcome-cta-btn"
      >
        <Text style={styles.btnText}>{CTA_LABEL}</Text>
      </Pressable>
    </Animated.View>
  );
}

// Main ---------------------------------------------------------------------
export default function Welcome() {
  const router = useRouter();

  // Mute toggle for ambient splash sound (persisted across launches).
  const [muted, setMutedState] = useState(false);
  const [muteHydrated, setMuteHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await isMuted();
      if (cancelled) return;
      setMutedState(m);
      setMuteHydrated(true);
      if (!m) {
        // Fire-and-forget — fades in, fails silently if anything goes wrong.
        startSplashSound();
      }
    })();
    return () => {
      cancelled = true;
      stopSplashSound();
    };
  }, []);

  const onToggleMute = async () => {
    const next = !muted;
    setMutedState(next);
    await setMuted(next);
    if (next) {
      await stopSplashSound();
    } else {
      startSplashSound();
    }
  };

  const onCtaPress = () => {
    // Stop ambient sound before navigating away.
    stopSplashSound();
    router.push('/(auth)/signup');
  };

  const particles = useMemo(
    () =>
      new Array(16).fill(0).map((_, i) => ({
        id: i,
        startX: Math.random() * SCREEN_W,
        size: 2 + Math.random() * 3,
        duration: 9000 + Math.random() * 7000,
        delay: Math.random() * 6000,
        driftX: 18 + Math.random() * 22,
      })),
    []
  );

  // App-name fade-in
  const appOpacity = useSharedValue(0);
  const appTranslate = useSharedValue(8);
  useEffect(() => {
    appOpacity.value = withDelay(
      APP_START,
      withTiming(1, { duration: APP_DURATION, easing: Easing.out(Easing.cubic) })
    );
    appTranslate.value = withDelay(
      APP_START,
      withTiming(0, { duration: APP_DURATION, easing: Easing.out(Easing.cubic) })
    );
  }, []);
  const appStyle = useAnimatedStyle(() => ({
    opacity: appOpacity.value,
    transform: [{ translateY: appTranslate.value }],
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {/* Base vertical gradient: deep navy → indigo → amber → warm gold */}
      <LinearGradient
        colors={[...colors.splash.gradient]}
        locations={[...colors.splash.gradientLocations]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Radial sun glow at top — breathing */}
      <SunGlow />

      {/* Storm cloud blobs drifting horizontally */}
      <Cloud top={SCREEN_H * 0.35} size={SCREEN_W * 1.3} baseX={-SCREEN_W * 0.2} amplitude={28} duration={11000} opacity={0.32} />
      <Cloud top={SCREEN_H * 0.48} size={SCREEN_W * 1.05} baseX={-SCREEN_W * 0.05} amplitude={36} duration={14000} opacity={0.42} />
      <Cloud top={SCREEN_H * 0.62} size={SCREEN_W * 1.4} baseX={-SCREEN_W * 0.25} amplitude={24} duration={17000} opacity={0.55} />

      {/* Light particles drifting upward */}
      {particles.map((p) => (
        <Particle key={p.id} {...p} />
      ))}

      {/* Top vignette to anchor the app name */}
      <LinearGradient
        colors={[colors.overlayLight, 'transparent']}
        style={[StyleSheet.absoluteFill, { height: SCREEN_H * 0.35 }]}
        pointerEvents="none"
      />
      {/* Bottom vignette to anchor the button */}
      <LinearGradient
        colors={['transparent', colors.overlayHeavy]}
        style={[
          StyleSheet.absoluteFill,
          { top: SCREEN_H * 0.6 },
        ]}
        pointerEvents="none"
      />

      {/* App name (top, gold) */}
      <Animated.Text style={[styles.appName, appStyle]} testID="welcome-appname">
        {APP_NAME}
      </Animated.Text>

      {/* Hero + sub copy (centered) */}
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.heroLine} testID="welcome-hero">
          {HERO_WORDS.map((w, i) => (
            <FadeWord
              key={`h-${i}`}
              word={w}
              delay={HERO_START + i * WORD_GAP}
              style={styles.heroWord}
            />
          ))}
        </Text>

        <View style={{ height: 24 }} />

        <Text style={styles.subLine} testID="welcome-sub">
          {SUB_WORDS.map((w, i) => (
            <FadeWord
              key={`s-${i}`}
              word={w}
              delay={SUB_START + i * WORD_GAP}
              style={styles.subWord}
            />
          ))}
        </Text>
      </View>

      {/* CTA */}
      <View style={styles.bottom} pointerEvents="box-none">
        <PulsingButton onPress={onCtaPress} />
      </View>

      {/* Discreet speaker toggle (top-right). Hidden until mute pref hydrates
          to avoid a brief flash on the wrong icon. */}
      {muteHydrated && Platform.OS !== 'web' && (
        <Pressable
          onPress={onToggleMute}
          style={({ pressed }) => [
            styles.speakerBtn,
            pressed && { opacity: 0.6 },
          ]}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Unmute ambient sound' : 'Mute ambient sound'}
          testID="welcome-speaker-toggle"
        >
          {muted ? (
            <VolumeX size={18} color="#FFFFFF" strokeWidth={1.6} />
          ) : (
            <Volume2 size={18} color="#FFFFFF" strokeWidth={1.6} />
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.splash.bgFallback,
    overflow: 'hidden',
  },
  cloud: {
    position: 'absolute',
    backgroundColor: colors.splash.cloudShadow,
  },
  particle: {
    position: 'absolute',
    backgroundColor: colors.splash.particle,
    shadowColor: colors.splash.particleGlow,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  appName: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 78 : 64,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: fonts.serifBold,
    fontSize: 26,
    letterSpacing: 1.2,
    color: colors.splash.appName,
    textShadowColor: colors.splash.appNameGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroLine: {
    textAlign: 'center',
    color: colors.splash.headlineText,
  },
  heroWord: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 42,
    color: colors.splash.headlineText,
    letterSpacing: -0.3,
    textShadowColor: colors.splash.headlineShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  subLine: {
    textAlign: 'center',
    color: colors.splash.subText,
  },
  subWord: {
    fontFamily: fonts.serif,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 26,
    color: colors.splash.subText,
    textShadowColor: colors.splash.subShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  bottom: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 56 : 44,
    left: 28,
    right: 28,
    alignItems: 'center',
  },
  btnWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGlow: {
    position: 'absolute',
    top: -8,
    bottom: -8,
    left: -8,
    right: -8,
    borderRadius: 999,
    backgroundColor: colors.splash.buttonGlow,
  },
  btn: {
    backgroundColor: colors.splash.buttonBg,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 999,
    alignItems: 'center',
    width: '100%',
    shadowColor: colors.splash.buttonShadow,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  btnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 15.5,
    color: colors.splash.buttonText,
    letterSpacing: 0.3,
  },
  speakerBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});
