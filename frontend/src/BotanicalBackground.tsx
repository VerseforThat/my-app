// BotanicalBackground — soft, semi-transparent watercolor-style botanical
// accent placed absolutely behind every screen's content (except the
// cinematic welcome splash, which has its own background).
//
// Design intent: premium therapeutic-journal aesthetic — Scandinavian
// wellness × botanical stationery. Static. Edges only, never centre.

import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import Svg, { Path, Circle, G, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const BASE_BG = '#F8F7F4';
const ROSE_GOLD = '#B76E79';
const ROSE_BLUSH = '#D9A3AB';
const ROSE_PALE = '#F4D4D9';
const SAGE = '#A8B5A2';

// ---------- Top-left cluster ----------------------------------------------
function TopLeftCluster() {
  const c = ROSE_GOLD;
  return (
    <Svg width={170} height={170} viewBox="0 0 100 100">
      {/* Long sweeping stem */}
      <Path
        d="M 8 100 C 12 70 18 50 22 30"
        stroke={c}
        strokeWidth={0.7}
        fill="none"
        strokeLinecap="round"
      />
      {/* Secondary stem */}
      <Path
        d="M 30 100 C 32 75 40 55 48 38"
        stroke={c}
        strokeWidth={0.6}
        fill="none"
        strokeLinecap="round"
      />
      {/* Leaves on stems */}
      <Path
        d="M 14 80 Q 5 76 6 70 Q 12 72 14 80 Z"
        fill={SAGE}
        opacity={0.55}
      />
      <Path
        d="M 18 56 Q 27 52 28 46 Q 22 46 18 56 Z"
        fill={SAGE}
        opacity={0.55}
      />
      <Path
        d="M 36 78 Q 45 74 47 68 Q 40 67 36 78 Z"
        fill={SAGE}
        opacity={0.55}
      />
      {/* Flower 1 — 5 petals */}
      <G>
        {[0, 72, 144, 216, 288].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <Circle
              key={i}
              cx={22 + 5.5 * Math.cos(rad)}
              cy={28 + 5.5 * Math.sin(rad)}
              r={4.5}
              fill={ROSE_BLUSH}
            />
          );
        })}
        <Circle cx={22} cy={28} r={2.2} fill={ROSE_PALE} />
      </G>
      {/* Flower 2 — slightly smaller */}
      <G>
        {[18, 90, 162, 234, 306].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <Circle
              key={i}
              cx={48 + 4.4 * Math.cos(rad)}
              cy={36 + 4.4 * Math.sin(rad)}
              r={3.6}
              fill={ROSE_BLUSH}
            />
          );
        })}
        <Circle cx={48} cy={36} r={1.8} fill={ROSE_PALE} />
      </G>
      {/* Tiny bud */}
      <Circle cx={36} cy={20} r={2.2} fill={ROSE_GOLD} opacity={0.7} />
    </Svg>
  );
}

// ---------- Top-right small accent ----------------------------------------
function TopRightAccent() {
  return (
    <Svg width={70} height={70} viewBox="0 0 50 50">
      {/* Single curling stem */}
      <Path
        d="M 45 5 Q 35 18 38 32 Q 40 42 28 48"
        stroke={ROSE_GOLD}
        strokeWidth={0.6}
        fill="none"
        strokeLinecap="round"
      />
      {/* Leaf */}
      <Path
        d="M 38 20 Q 48 18 49 12 Q 42 12 38 20 Z"
        fill={SAGE}
        opacity={0.6}
      />
      {/* Tiny flower */}
      <G>
        {[0, 72, 144, 216, 288].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <Circle
              key={i}
              cx={28 + 3 * Math.cos(rad)}
              cy={48 + 3 * Math.sin(rad)}
              r={2.4}
              fill={ROSE_BLUSH}
            />
          );
        })}
      </G>
    </Svg>
  );
}

// ---------- Bottom-right flowing branch -----------------------------------
function BottomRightBranch() {
  const c = ROSE_GOLD;
  return (
    <Svg width={240} height={240} viewBox="0 0 120 120">
      {/* Main flowing branch */}
      <Path
        d="M 120 30 C 100 35 85 50 78 70 C 72 88 78 105 90 120"
        stroke={c}
        strokeWidth={0.9}
        fill="none"
        strokeLinecap="round"
      />
      {/* Secondary branch */}
      <Path
        d="M 95 55 C 105 60 112 70 115 82"
        stroke={c}
        strokeWidth={0.7}
        fill="none"
        strokeLinecap="round"
      />
      {/* Leaves along the branch */}
      <Path
        d="M 100 38 Q 112 36 116 28 Q 108 26 100 38 Z"
        fill={SAGE}
        opacity={0.55}
      />
      <Path
        d="M 84 60 Q 96 58 99 50 Q 90 49 84 60 Z"
        fill={SAGE}
        opacity={0.55}
      />
      <Path
        d="M 78 82 Q 67 80 64 72 Q 72 70 78 82 Z"
        fill={SAGE}
        opacity={0.55}
      />
      <Path
        d="M 88 100 Q 100 100 104 92 Q 95 90 88 100 Z"
        fill={SAGE}
        opacity={0.55}
      />
      {/* Larger blossom */}
      <G>
        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <Circle
              key={i}
              cx={86 + 6.5 * Math.cos(rad)}
              cy={75 + 6.5 * Math.sin(rad)}
              r={5.5}
              fill={ROSE_BLUSH}
            />
          );
        })}
        <Circle cx={86} cy={75} r={3} fill={ROSE_PALE} />
      </G>
      {/* Smaller blossom up the branch */}
      <G>
        {[0, 72, 144, 216, 288].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <Circle
              key={i}
              cx={102 + 4.2 * Math.cos(rad)}
              cy={50 + 4.2 * Math.sin(rad)}
              r={3.5}
              fill={ROSE_BLUSH}
            />
          );
        })}
        <Circle cx={102} cy={50} r={1.8} fill={ROSE_PALE} />
      </G>
      {/* Tiny bud near the base */}
      <Circle cx={98} cy={108} r={2.4} fill={ROSE_GOLD} opacity={0.7} />
      <Circle cx={108} cy={113} r={1.8} fill={ROSE_GOLD} opacity={0.6} />
    </Svg>
  );
}

// --------------------------------------------------------------------------
type Props = {
  /** Optional override base color (e.g. for full-screen modals). */
  baseColor?: string;
};

function BotanicalBackground({ baseColor = BASE_BG }: Props) {
  return (
    <View
      style={[styles.fill, { backgroundColor: baseColor }]}
      pointerEvents="none"
      // Hide from screen readers — pure decoration.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.topLeft}>
        <TopLeftCluster />
      </View>
      <View style={styles.topRight}>
        <TopRightAccent />
      </View>
      <View style={styles.bottomRight}>
        <BottomRightBranch />
      </View>
    </View>
  );
}

export default React.memo(BotanicalBackground);
export { BASE_BG };

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  topLeft: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? -10 : 0,
    left: -16,
    opacity: 0.13,
  },
  topRight: {
    position: 'absolute',
    top: 100,
    right: -10,
    opacity: 0.10,
  },
  bottomRight: {
    position: 'absolute',
    bottom: -20,
    right: -28,
    opacity: 0.13,
  },
});
