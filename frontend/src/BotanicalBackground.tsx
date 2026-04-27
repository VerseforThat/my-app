// BotanicalBackground — soft, semi-transparent CHERRY BLOSSOMS &
// EUCALYPTUS placed absolutely behind every screen's content
// (except the cinematic welcome splash which has its own background).
//
// Design intent: premium therapeutic-journal aesthetic — Scandinavian
// wellness × botanical stationery. Static. Edges only, never centre.
//
// Style notes:
//   • Cherry blossoms (sakura) — 5 notched petals around a tiny stamen center
//   • Eucalyptus — paired round leaves cascading along a SHORT stem
//   • Stems are intentionally short. Focus is on leaves and flowers.
//   • Rose gold petals + sage eucalyptus leaves.

import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import Svg, { Path, Circle, Ellipse, G } from 'react-native-svg';

const BASE_BG = '#F8F7F4';

// Rose-gold flower palette (per user spec)
const ROSE_GOLD = '#B76E79';
const ROSE_DEEP = '#8B4D58';
const ROSE_BLUSH = '#D9A3AB';
const ROSE_PALE = '#F4D4D9';

// Eucalyptus leaf palette (sage)
const SAGE = '#A8B5A2';
const SAGE_DEEP = '#7E8E78';

// ---------- Cherry Blossom -----------------------------------------------
// 5 notched petals around a center cluster of tiny stamens.
// Petal SVG path is drawn pointing UP from origin (0,0); rotated into place.
const CHERRY_PETAL_PATH =
  'M 0 0 C -2.6 -1.8 -4.6 -6.5 -2.4 -9.8 Q -1.4 -9.0 -0.7 -9.4 Q 0 -9.9 0.7 -9.4 Q 1.4 -9.0 2.4 -9.8 C 4.6 -6.5 2.6 -1.8 0 0 Z';

function CherryBlossom({
  cx,
  cy,
  size = 1,
  petalColor = ROSE_GOLD,
  centerColor = ROSE_DEEP,
  rotate = 0,
}: {
  cx: number;
  cy: number;
  size?: number;
  petalColor?: string;
  centerColor?: string;
  rotate?: number;
}) {
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const deg = (i * 360) / 5 + rotate;
    petals.push(
      <Path
        key={i}
        d={CHERRY_PETAL_PATH}
        fill={petalColor}
        transform={`translate(${cx} ${cy}) rotate(${deg}) scale(${size})`}
      />
    );
  }
  // Stamens — small radiating dots in the deeper rose tone.
  const stamens = [];
  for (let i = 0; i < 7; i++) {
    const a = (i * (360 / 7)) * (Math.PI / 180);
    stamens.push(
      <Circle
        key={`s${i}`}
        cx={cx + 1.4 * size * Math.cos(a)}
        cy={cy + 1.4 * size * Math.sin(a)}
        r={0.45 * size}
        fill={centerColor}
      />
    );
  }
  return (
    <G>
      {petals}
      <Circle cx={cx} cy={cy} r={1.0 * size} fill={centerColor} />
      {stamens}
    </G>
  );
}

/** A single cherry-blossom petal that has fallen off — adds a delicate accent. */
function FallenPetal({
  cx,
  cy,
  size = 1,
  color = ROSE_BLUSH,
  rotate = 0,
}: {
  cx: number;
  cy: number;
  size?: number;
  color?: string;
  rotate?: number;
}) {
  return (
    <Path
      d={CHERRY_PETAL_PATH}
      fill={color}
      transform={`translate(${cx} ${cy}) rotate(${rotate}) scale(${size})`}
    />
  );
}

// ---------- Eucalyptus -----------------------------------------------------
// Pairs of round leaves cascading along a SHORT stem. Leaves are the focus.
function Eucalyptus({
  x,
  y,
  size = 1,
  length = 24,
  angle = 0,
  leafPairs = 5,
  alternate = false,
  color = SAGE,
  colorDeep = SAGE_DEEP,
}: {
  x: number;
  y: number;
  size?: number;
  length?: number;
  angle?: number;
  leafPairs?: number;
  alternate?: boolean;
  color?: string;
  colorDeep?: string;
}) {
  const items: React.ReactNode[] = [];
  // Short stem — kept short on purpose; barely visible behind leaves.
  items.push(
    <Path
      key="stem"
      d={`M 0 0 L ${length} 0`}
      stroke={colorDeep}
      strokeWidth={0.5 * size}
      fill="none"
      strokeLinecap="round"
      opacity={0.85}
    />
  );

  for (let i = 0; i < leafPairs; i++) {
    const t = i / Math.max(1, leafPairs - 1);
    const xp = t * length;
    // Leaves slightly smaller toward the tip
    const lf = (1 - t * 0.38) * size;
    const ry = 2.6 * lf;
    const rx = 3.4 * lf;

    if (alternate) {
      const flip = i % 2 === 0 ? 1 : -1;
      items.push(
        <Ellipse
          key={`l-${i}`}
          cx={xp}
          cy={flip * (3.4 * size)}
          rx={rx}
          ry={ry}
          fill={i % 2 === 0 ? color : colorDeep}
          opacity={0.85}
          transform={`rotate(${flip * 18} ${xp} ${flip * (3.4 * size)})`}
        />
      );
    } else {
      // Opposite pairs — top & bottom of stem
      items.push(
        <Ellipse
          key={`l-up-${i}`}
          cx={xp + 0.4 * size}
          cy={-3.4 * size}
          rx={rx}
          ry={ry}
          fill={color}
          opacity={0.88}
          transform={`rotate(-22 ${xp + 0.4 * size} ${-3.4 * size})`}
        />,
        <Ellipse
          key={`l-dn-${i}`}
          cx={xp - 0.4 * size}
          cy={3.4 * size}
          rx={rx}
          ry={ry}
          fill={colorDeep}
          opacity={0.82}
          transform={`rotate(22 ${xp - 0.4 * size} ${3.4 * size})`}
        />
      );
    }
  }

  // Tip leaf — small round leaf at the end
  items.push(
    <Ellipse
      key="tip"
      cx={length + 1.5 * size}
      cy={0}
      rx={2.4 * size}
      ry={2.0 * size}
      fill={color}
      opacity={0.9}
    />
  );

  return <G transform={`translate(${x} ${y}) rotate(${angle})`}>{items}</G>;
}

// ===========================================================================
// COMPOSITIONS
// ===========================================================================

// ---------- Top-left cluster ---------------------------------------------
function TopLeftCluster() {
  return (
    <Svg width={210} height={210} viewBox="0 0 100 100">
      {/* Two flowing eucalyptus branches drape down from edge */}
      <Eucalyptus x={-2} y={28} angle={42} length={48} leafPairs={6} size={0.95} />
      <Eucalyptus x={-4} y={62} angle={20} length={44} leafPairs={5} size={0.85} colorDeep={SAGE} color={SAGE_DEEP} />
      {/* Smaller eucalyptus sprig hanging off */}
      <Eucalyptus x={48} y={20} angle={75} length={26} leafPairs={4} size={0.75} alternate />

      {/* Cherry blossom cluster — 4 blossoms */}
      <CherryBlossom cx={28} cy={26} size={1.05} rotate={6} />
      <CherryBlossom cx={48} cy={42} size={0.92} rotate={-22} />
      <CherryBlossom cx={64} cy={28} size={0.85} petalColor={ROSE_BLUSH} rotate={48} />
      <CherryBlossom cx={20} cy={50} size={0.78} petalColor={ROSE_BLUSH} rotate={30} />

      {/* Small fallen petal accents */}
      <FallenPetal cx={78} cy={56} size={0.7} rotate={120} />
      <FallenPetal cx={42} cy={68} size={0.6} rotate={200} color={ROSE_PALE} />
      <FallenPetal cx={14} cy={78} size={0.55} rotate={-30} color={ROSE_PALE} />

      {/* Tiny bud accents */}
      <Circle cx={82} cy={20} r={1.6} fill={ROSE_GOLD} />
      <Circle cx={86} cy={26} r={1.0} fill={ROSE_BLUSH} />
    </Svg>
  );
}

// ---------- Top-right small accent ----------------------------------------
function TopRightAccent() {
  return (
    <Svg width={95} height={95} viewBox="0 0 50 50">
      {/* Eucalyptus tucked in from edge */}
      <Eucalyptus x={48} y={14} angle={140} length={28} leafPairs={4} size={0.85} />
      {/* Small accent eucalyptus */}
      <Eucalyptus x={44} y={36} angle={170} length={20} leafPairs={3} size={0.7} alternate />
      {/* Cherry blossom */}
      <CherryBlossom cx={28} cy={14} size={0.95} rotate={-18} />
      <FallenPetal cx={36} cy={32} size={0.6} rotate={210} color={ROSE_BLUSH} />
    </Svg>
  );
}

// ---------- Bottom-left wisp ---------------------------------------------
function BottomLeftWisp() {
  return (
    <Svg width={140} height={140} viewBox="0 0 80 80">
      {/* Eucalyptus rising from corner */}
      <Eucalyptus x={4} y={72} angle={-58} length={42} leafPairs={5} size={0.95} />
      <Eucalyptus x={2} y={56} angle={-30} length={28} leafPairs={4} size={0.75} alternate />
      {/* Cherry blossom + buds */}
      <CherryBlossom cx={36} cy={26} size={0.88} rotate={20} />
      <CherryBlossom cx={20} cy={42} size={0.7} petalColor={ROSE_BLUSH} rotate={-40} />
      <FallenPetal cx={48} cy={48} size={0.65} rotate={150} color={ROSE_PALE} />
      <Circle cx={50} cy={20} r={1.3} fill={ROSE_GOLD} />
    </Svg>
  );
}

// ---------- Bottom-right branch -------------------------------------------
function BottomRightBranch() {
  return (
    <Svg width={290} height={290} viewBox="0 0 120 120">
      {/* Long flowing eucalyptus branches from edge */}
      <Eucalyptus x={120} y={42} angle={172} length={62} leafPairs={7} size={1.0} />
      <Eucalyptus x={120} y={70} angle={154} length={54} leafPairs={6} size={0.9} colorDeep={SAGE} color={SAGE_DEEP} />
      <Eucalyptus x={120} y={100} angle={184} length={50} leafPairs={5} size={0.85} alternate />
      {/* Vertical eucalyptus rising up from the bottom */}
      <Eucalyptus x={92} y={120} angle={-90} length={40} leafPairs={5} size={0.85} alternate />

      {/* Cherry blossom cluster — 5 blossoms */}
      <CherryBlossom cx={78} cy={70} size={1.25} rotate={8} />
      <CherryBlossom cx={96} cy={56} size={1.0} petalColor={ROSE_BLUSH} rotate={-30} />
      <CherryBlossom cx={62} cy={86} size={0.88} rotate={42} />
      <CherryBlossom cx={102} cy={88} size={0.95} petalColor={ROSE_BLUSH} rotate={-12} />
      <CherryBlossom cx={84} cy={102} size={0.75} petalColor={ROSE_PALE} rotate={20} />

      {/* Loose fallen petals */}
      <FallenPetal cx={48} cy={102} size={0.7} rotate={130} color={ROSE_PALE} />
      <FallenPetal cx={70} cy={114} size={0.6} rotate={210} color={ROSE_BLUSH} />
      <FallenPetal cx={114} cy={68} size={0.65} rotate={50} color={ROSE_PALE} />
      <FallenPetal cx={56} cy={66} size={0.55} rotate={-40} color={ROSE_PALE} />

      {/* Tiny rose-gold buds for texture */}
      <Circle cx={108} cy={114} r={1.6} fill={ROSE_GOLD} />
      <Circle cx={114} cy={110} r={1.1} fill={ROSE_BLUSH} />
      <Circle cx={50} cy={84} r={1.2} fill={ROSE_GOLD} />
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
    bottom: -8,
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
