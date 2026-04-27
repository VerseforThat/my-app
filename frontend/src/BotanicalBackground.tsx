// BotanicalBackground — soft, semi-transparent watercolor-style WILDFLOWER
// accents placed absolutely behind every screen's content (except the
// cinematic welcome splash, which has its own background).
//
// Design intent: premium therapeutic-journal aesthetic — Scandinavian
// wellness × botanical stationery. Static. Edges only, never centre.
//
// Wildflowers (not stylised garden flowers):
//   • Daisies — long oval petals radiating from a small dark center
//   • Lavender — thin upright stalks with tiny offset buds
//   • Poppies — 4 wide rounded petals with a deep center
//   • Forget-me-nots — tiny 5-petal accents
//   • Buds, slim leaves, grass blades for filler

import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import Svg, { Path, Circle, Ellipse, G } from 'react-native-svg';

const BASE_BG = '#F8F7F4';
const ROSE_GOLD = '#B76E79';
const ROSE_DEEP = '#8B4D58';
const ROSE_BLUSH = '#D9A3AB';
const ROSE_PALE = '#F4D4D9';
const SAGE = '#A8B5A2';
const SAGE_DEEP = '#7E8E78';

// ---------- Reusable wildflower primitives -------------------------------

function Daisy({
  cx,
  cy,
  size = 1,
  petalColor = ROSE_BLUSH,
  centerColor = ROSE_DEEP,
  petalCount = 11,
  petalLength = 3.4,
  petalWidth = 1.4,
  petalRadius = 4.8,
  centerRadius = 1.8,
}: {
  cx: number;
  cy: number;
  size?: number;
  petalColor?: string;
  centerColor?: string;
  petalCount?: number;
  petalLength?: number;
  petalWidth?: number;
  petalRadius?: number;
  centerRadius?: number;
}) {
  const petals = [];
  for (let i = 0; i < petalCount; i++) {
    const deg = (i * 360) / petalCount;
    const rad = (deg * Math.PI) / 180;
    const px = cx + petalRadius * size * Math.cos(rad);
    const py = cy + petalRadius * size * Math.sin(rad);
    petals.push(
      <Ellipse
        key={i}
        cx={px}
        cy={py}
        rx={petalLength * size}
        ry={petalWidth * size}
        fill={petalColor}
        transform={`rotate(${deg} ${px} ${py})`}
      />
    );
  }
  return (
    <G>
      {petals}
      <Circle cx={cx} cy={cy} r={centerRadius * size} fill={centerColor} />
    </G>
  );
}

function Poppy({ cx, cy, size = 1 }: { cx: number; cy: number; size?: number }) {
  return (
    <G>
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const px = cx + 4 * size * Math.cos(rad);
        const py = cy + 4 * size * Math.sin(rad);
        return (
          <Ellipse
            key={deg}
            cx={px}
            cy={py}
            rx={5.6 * size}
            ry={4.4 * size}
            fill={ROSE_GOLD}
            transform={`rotate(${deg + 45} ${px} ${py})`}
          />
        );
      })}
      <Circle cx={cx} cy={cy} r={2.7 * size} fill={ROSE_DEEP} />
      {[30, 90, 150, 210, 270, 330].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <Circle
            key={deg}
            cx={cx + 1.7 * size * Math.cos(rad)}
            cy={cy + 1.7 * size * Math.sin(rad)}
            r={0.55 * size}
            fill={ROSE_PALE}
          />
        );
      })}
    </G>
  );
}

function Lavender({
  x,
  y,
  size = 1,
  buds = 8,
  spacing = 3,
  angle = 0,
  budColor = ROSE_GOLD,
}: {
  x: number;
  y: number;
  size?: number;
  buds?: number;
  spacing?: number;
  angle?: number;
  budColor?: string;
}) {
  const items: React.ReactNode[] = [];
  items.push(
    <Path
      key="stem"
      d={`M ${x} ${y + buds * spacing * size} L ${x} ${y + (buds + 5) * spacing * size}`}
      stroke={SAGE_DEEP}
      strokeWidth={0.65 * size}
      fill="none"
      strokeLinecap="round"
    />
  );
  for (let i = 0; i < buds; i++) {
    const yp = y + i * spacing * size;
    const xOffset = (i % 2 === 0 ? 1 : -1) * size;
    items.push(
      <Ellipse
        key={`b${i}`}
        cx={x + xOffset}
        cy={yp}
        rx={1.6 * size}
        ry={2 * size}
        fill={budColor}
      />
    );
  }
  items.push(<Circle key="top" cx={x} cy={y - 1 * size} r={1.7 * size} fill={budColor} />);
  return <G transform={`rotate(${angle} ${x} ${y + buds * spacing * 0.5 * size})`}>{items}</G>;
}

function ForgetMeNot({
  cx,
  cy,
  size = 1,
  color = ROSE_BLUSH,
}: {
  cx: number;
  cy: number;
  size?: number;
  color?: string;
}) {
  return (
    <G>
      {[0, 72, 144, 216, 288].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <Circle
            key={deg}
            cx={cx + 1.9 * size * Math.cos(rad)}
            cy={cy + 1.9 * size * Math.sin(rad)}
            r={1.7 * size}
            fill={color}
          />
        );
      })}
      <Circle cx={cx} cy={cy} r={0.8 * size} fill={ROSE_PALE} />
    </G>
  );
}

function SlimLeaf({
  cx,
  cy,
  size = 1,
  rotate = 0,
  color = SAGE,
}: {
  cx: number;
  cy: number;
  size?: number;
  rotate?: number;
  color?: string;
}) {
  return (
    <Ellipse
      cx={cx}
      cy={cy}
      rx={5.5 * size}
      ry={1.6 * size}
      fill={color}
      opacity={0.8}
      transform={`rotate(${rotate} ${cx} ${cy})`}
    />
  );
}

function GrassBlade({
  x,
  y,
  size = 1,
  curve = 6,
  height = 30,
  color = SAGE_DEEP,
}: {
  x: number;
  y: number;
  size?: number;
  curve?: number;
  height?: number;
  color?: string;
}) {
  return (
    <Path
      d={`M ${x} ${y} Q ${x + curve} ${y - height / 2} ${x + curve * 1.5} ${y - height}`}
      stroke={color}
      strokeWidth={0.55 * size}
      fill="none"
      strokeLinecap="round"
      opacity={0.75}
    />
  );
}

// ---------- Top-left cluster — daisies + lavender + buds -----------------
function TopLeftCluster() {
  return (
    <Svg width={210} height={210} viewBox="0 0 100 100">
      {/* Tall sweeping stems */}
      <Path d="M 20 100 C 18 75 22 55 24 30" stroke={SAGE_DEEP} strokeWidth={0.85} fill="none" strokeLinecap="round" />
      <Path d="M 50 100 C 48 78 54 60 56 38" stroke={SAGE_DEEP} strokeWidth={0.8} fill="none" strokeLinecap="round" />
      <Path d="M 70 100 C 70 85 73 70 72 56" stroke={SAGE_DEEP} strokeWidth={0.7} fill="none" strokeLinecap="round" />
      {/* Slim leaves on stems */}
      <SlimLeaf cx={18} cy={70} rotate={70} />
      <SlimLeaf cx={26} cy={55} rotate={-65} size={0.85} />
      <SlimLeaf cx={50} cy={75} rotate={75} />
      <SlimLeaf cx={59} cy={62} rotate={-60} size={0.85} />
      <SlimLeaf cx={73} cy={82} rotate={60} size={0.75} />
      {/* Grass blades for texture */}
      <GrassBlade x={6} y={100} curve={4} height={32} size={0.9} />
      <GrassBlade x={36} y={100} curve={-3} height={26} size={0.8} />
      <GrassBlade x={84} y={100} curve={-5} height={28} size={0.85} />
      {/* Three daisies — main + secondary + small */}
      <Daisy cx={24} cy={26} petalCount={12} petalLength={3.6} petalWidth={1.4} petalRadius={5.0} centerRadius={1.9} />
      <Daisy cx={56} cy={34} size={0.95} petalCount={11} petalLength={3.3} petalWidth={1.3} petalRadius={4.6} />
      <Daisy
        cx={72}
        cy={52}
        size={0.78}
        petalCount={10}
        petalLength={3.0}
        petalWidth={1.2}
        petalRadius={4.2}
        centerRadius={1.6}
        petalColor={ROSE_PALE}
      />
      {/* Lavender stalks tucked between */}
      <Lavender x={38} y={48} size={0.75} buds={6} spacing={2.7} angle={-12} />
      <Lavender x={86} y={66} size={0.65} buds={5} spacing={2.5} angle={10} budColor={ROSE_BLUSH} />
      {/* Forget-me-not accents */}
      <ForgetMeNot cx={68} cy={18} size={0.95} color={ROSE_GOLD} />
      <ForgetMeNot cx={42} cy={22} size={0.7} color={ROSE_BLUSH} />
      <ForgetMeNot cx={12} cy={42} size={0.75} color={ROSE_GOLD} />
    </Svg>
  );
}

// ---------- Top-right small accent — daisy + buds ------------------------
function TopRightAccent() {
  return (
    <Svg width={95} height={95} viewBox="0 0 50 50">
      {/* Curling stems */}
      <Path
        d="M 48 50 C 42 38 40 24 35 14"
        stroke={SAGE_DEEP}
        strokeWidth={0.8}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M 48 36 C 44 32 42 28 40 24"
        stroke={SAGE_DEEP}
        strokeWidth={0.65}
        fill="none"
        strokeLinecap="round"
      />
      <SlimLeaf cx={43} cy={32} size={0.8} rotate={50} />
      <SlimLeaf cx={45} cy={42} size={0.6} rotate={-40} />
      <Daisy
        cx={33}
        cy={12}
        size={0.95}
        petalCount={11}
        petalLength={3.2}
        petalWidth={1.3}
        petalRadius={4.5}
        centerRadius={1.7}
      />
      <ForgetMeNot cx={42} cy={26} size={0.7} color={ROSE_GOLD} />
    </Svg>
  );
}

// ---------- Bottom-right branch — poppy + daisy + lavender (full) -------
function BottomRightBranch() {
  return (
    <Svg width={290} height={290} viewBox="0 0 120 120">
      {/* Main flowing stems */}
      <Path
        d="M 120 30 C 100 35 80 50 72 72 C 66 90 74 108 88 120"
        stroke={SAGE_DEEP}
        strokeWidth={1}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M 120 56 C 105 60 95 70 90 84"
        stroke={SAGE_DEEP}
        strokeWidth={0.8}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M 76 120 C 76 108 80 96 84 86"
        stroke={SAGE_DEEP}
        strokeWidth={0.75}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M 120 90 C 110 96 102 104 100 116"
        stroke={SAGE_DEEP}
        strokeWidth={0.65}
        fill="none"
        strokeLinecap="round"
      />
      {/* Slim leaves throughout */}
      <SlimLeaf cx={100} cy={40} rotate={-15} size={1.15} />
      <SlimLeaf cx={86} cy={58} rotate={-40} size={1.05} />
      <SlimLeaf cx={74} cy={84} rotate={70} size={1.15} />
      <SlimLeaf cx={88} cy={104} rotate={-20} size={0.95} />
      <SlimLeaf cx={108} cy={66} rotate={-25} size={0.85} />
      <SlimLeaf cx={114} cy={100} rotate={-50} size={0.9} />
      {/* Hero poppy */}
      <Poppy cx={82} cy={72} size={1.2} />
      {/* Companion daisy on secondary stem */}
      <Daisy
        cx={102}
        cy={48}
        size={0.95}
        petalCount={12}
        petalLength={3.3}
        petalWidth={1.35}
        petalRadius={4.7}
        centerRadius={1.85}
      />
      {/* Second smaller daisy lower */}
      <Daisy
        cx={94}
        cy={94}
        size={0.78}
        petalCount={10}
        petalLength={2.9}
        petalWidth={1.2}
        petalRadius={4.0}
        centerRadius={1.6}
        petalColor={ROSE_PALE}
      />
      {/* Lavender stalks */}
      <Lavender x={80} y={86} size={0.95} buds={7} spacing={2.9} angle={-8} />
      <Lavender x={112} y={76} size={0.75} buds={5} spacing={2.6} angle={12} budColor={ROSE_BLUSH} />
      {/* Forget-me-not buds scattered */}
      <ForgetMeNot cx={104} cy={108} size={1.0} color={ROSE_GOLD} />
      <ForgetMeNot cx={114} cy={114} size={0.8} color={ROSE_BLUSH} />
      <ForgetMeNot cx={70} cy={104} size={0.75} color={ROSE_GOLD} />
      {/* Grass blades from edge */}
      <GrassBlade x={118} y={120} curve={-5} height={24} size={0.9} />
      <GrassBlade x={68} y={120} curve={3} height={20} size={0.8} />
    </Svg>
  );
}

// ---------- Bottom-left small wisp — fills empty corner ------------------
function BottomLeftWisp() {
  return (
    <Svg width={130} height={130} viewBox="0 0 80 80">
      {/* Sweeping stems */}
      <Path d="M 0 78 C 12 70 18 56 22 40" stroke={SAGE_DEEP} strokeWidth={0.8} fill="none" strokeLinecap="round" />
      <Path d="M 0 68 C 8 64 14 58 18 50" stroke={SAGE_DEEP} strokeWidth={0.65} fill="none" strokeLinecap="round" />
      {/* Leaves */}
      <SlimLeaf cx={14} cy={58} rotate={-30} size={0.95} />
      <SlimLeaf cx={20} cy={45} rotate={50} size={0.85} />
      {/* Lavender + small daisy */}
      <Lavender x={22} y={32} size={0.8} buds={6} spacing={2.7} angle={15} />
      <Daisy
        cx={32}
        cy={20}
        size={0.8}
        petalCount={11}
        petalLength={3.1}
        petalWidth={1.25}
        petalRadius={4.3}
        centerRadius={1.6}
      />
      <ForgetMeNot cx={10} cy={46} size={0.7} color={ROSE_GOLD} />
      <GrassBlade x={4} y={80} curve={5} height={26} size={0.9} />
      <GrassBlade x={28} y={80} curve={-4} height={22} size={0.8} />
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
      <View style={styles.bottomLeft}>
        <BottomLeftWisp />
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
    left: -22,
    opacity: 0.20,
  },
  topRight: {
    position: 'absolute',
    top: 90,
    right: -10,
    opacity: 0.16,
  },
  bottomLeft: {
    position: 'absolute',
    bottom: -10,
    left: -16,
    opacity: 0.14,
  },
  bottomRight: {
    position: 'absolute',
    bottom: -28,
    right: -36,
    opacity: 0.20,
  },
});
