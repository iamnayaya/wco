/**
 * WCO Motion — design languages & presets.
 *
 * The 15 motion principles are the documented contract; the tables below make
 * them measurable, and `presets` turn them into ready-to-run animation specs.
 * Every consumer (components, hooks, Framer adapter) resolves against these so
 * a brand can retune the entire system from one place.
 */

import type { Easing } from './core';
import type { MotionStyleValues } from './core';

export type LoopMode = 'none' | 'loop' | 'mirror' | 'once';

export interface SpringSpec {
  stiffness: number;
  damping: number;
  mass?: number;
}

export interface PresetSpec {
  /** Animation driver: deterministic ease over time vs. physics settle. */
  mode?: 'tween' | 'spring';
  duration?: number;
  delay?: number;
  ease?: Easing;
  spring?: SpringSpec;
  /** Base travel distance in px (used by Slide/Parallax families). */
  distance?: number;
  from?: MotionStyleValues;
  to?: MotionStyleValues;
  loop?: LoopMode;
  /** Iterations when loop is 'loop'/'mirror'/'once' (0 = infinite). */
  counts?: number;
}

export interface Principle {
  name: string;
  intent: string;
  rules: string[];
}

/* --------------------------- the 15 principles --------------------------- */

export const PRINCIPLES: Principle[] = [
  {
    name: 'Purpose',
    intent: 'Every animation must communicate something: a state change, causality, or hierarchy.',
    rules: ['No decorative-only motion', 'Motion and stillness are both decisions'],
  },
  {
    name: 'Speed',
    intent: 'UI must feel instant; motion must never slow the user down.',
    rules: ['Micro: 120–150ms', 'Standard: 220–320ms', 'Attention/celebration: 450–900ms (rare)'],
  },
  {
    name: 'Easing',
    intent: 'The easing curve carries the personality and the physics.',
    rules: ['Enter: quick decelerate (out)', 'Exit: quick accelerate (in)', 'In/out only for dialogs, panels, large transitions'],
  },
  {
    name: 'Distance',
    intent: 'Travel distance is proportional to the element’s importance.',
    rules: ['Micro moves ≤ 24px', 'Medium 24–72px', 'Large only for hero/full-screen content'],
  },
  {
    name: 'Scale',
    intent: 'Scale emphasises importance without unsettling the layout.',
    rules: ['Typical scale range 0.9–1.05', '0.8-scale only for deliberate emphasis', 'Never distort layout geometry (transform-only)'],
  },
  {
    name: 'Blur',
    intent: 'Blur is a depth tool, not decoration.',
    rules: ['Keep ≤ 12px', 'Prefer opacity + blur combos for depth-in', 'Never blur focus-visible elements'],
  },
  {
    name: 'Overlap',
    intent: 'Motion is choreography, not a queue.',
    rules: ['Subordinate elements follow (overlap-out)', 'Replacement stacks as cross-fade (overlap-in-out)', 'Never run two full-width 320ms tweens sequentially'],
  },
  {
    name: 'Stagger',
    intent: 'Lists and grids cascade; they do not shuffle.',
    rules: ['24–60ms per child', 'Total cascade ≤ 300ms', 'Children animate toward a consistent direction'],
  },
  {
    name: 'Springs',
    intent: 'Physics says “natural”; misuse says “toy”.',
    rules: ['Stiffness 120–260, damping ≥ 0.5 × critical damping', 'Overshoot < 8% for UI', 'No perpetual-loop springs'],
  },
  {
    name: 'Reduced Motion',
    intent: 'Respect the OS preference without breaking meaning.',
    rules: ['prefers-reduced-motion: animate opacity only, or 0ms', 'Keep state changes instant', 'Never animate layout/clip when reduced'],
  },
  {
    name: 'Continuity',
    intent: 'Motion should feel like one material, not distant cut scenes.',
    rules: ['Transform + opacity only (GPU friendly)', 'Wash transitions with shared color/fade', 'Keep the element’s shadow/hierarchy constant'],
  },
  {
    name: 'Desync',
    intent: 'Content mutations and chrome feedback move on different clocks.',
    rules: ['Appears/moves: ≤ 160ms', 'Chrome fade/slide: 220–320ms', 'Never couple both to the same curve'],
  },
  {
    name: 'Feedback',
    intent: 'Every press needs an immediate, physical answer.',
    rules: ['Press feedback ≤ 30ms latency', 'Scale 0.95–1 on press, spring back on release', 'Long-press gets distinct visual state'],
  },
  {
    name: 'Interruption',
    intent: 'Motion must hand over control instantly.',
    rules: ['New input cancels the running animation', 'Settle (spring) on interruption', 'Never queue two animations'],
  },
  {
    name: 'Accessibility',
    intent: 'Motion is silent narration; it must be available to everyone.',
    rules: ['Announce substantial state changes via live regions', 'No flashing > 3 Hz', 'Nothing autoplays without user intent'],
  },
];

/* ------------------------------- duration -------------------------------- */

export interface DurationToken {
  name: string;
  ms: number;
  tone: string;
  when: string;
}

export const DURATIONS: DurationToken[] = [
  { name: 'micro', ms: 120, tone: 'instant', when: 'hover, press, tooltips, focus ring' },
  { name: 'quick', ms: 150, tone: 'fast', when: 'list items, checkmarks, badges' },
  { name: 'fast', ms: 220, tone: 'standard', when: 'tabs, accordions, small reveals' },
  { name: 'standard', ms: 320, tone: 'default', when: 'cards, dialogs, panels, page sections' },
  { name: 'deliberate', ms: 450, tone: 'considered', when: 'featured content, illustrations' },
  { name: 'slow', ms: 600, tone: 'expressive', when: 'hero text, success moments' },
  { name: 'cinematic', ms: 900, tone: 'story', when: 'onboarding, full-screen transitions' },
  { name: 'feature', ms: 1200, tone: 'celebration', when: 'earned achievements (rare)' },
];

export const duration = (name: string, fallback = 320): number =>
  DURATIONS.find((d) => d.name === name)?.ms ?? fallback;

/* ------------------------------- distance -------------------------------- */

export const DISTANCES = [
  { name: 'micro', px: 8 },
  { name: 'tiny', px: 16 },
  { name: 'small', px: 24 },
  { name: 'medium', px: 48 },
  { name: 'large', px: 96 },
  { name: 'wide', px: 160 },
  { name: 'hero', px: 240 },
] as const;

export const distance = (name: (typeof DISTANCES)[number]['name'] | number, fallback = 24): number =>
  typeof name === 'number' ? name : DISTANCES.find((d) => d.name === name)?.px ?? fallback;

/* -------------------------------- easing --------------------------------- */

export interface EasingToken {
  name: string;
  description: string;
  when: string;
}

export const EASINGS: EasingToken[] = [
  { name: 'linear', description: 'constant speed', when: 'metering, progress bars, continuous scroll' },
  { name: 'out', description: 'fast start, graceful settle', when: 'elements entering or appearing' },
  { name: 'in', description: 'slow build, fast exit', when: 'elements leaving or disappearing' },
  { name: 'inOut', description: 'slow both ends', when: 'dialogs, panels, show/hide pairs' },
  { name: 'circ', description: 'circular arc', when: 'modal / deep zoom focuses' },
  { name: 'back', description: 'slight overshoot', when: 'playful pop-ins, onboarding' },
  { name: 'anticipate', description: 'winds up before moving', when: 'hero entries, character beats' },
  { name: 'elastic', description: 'strong overshoot oscillation', when: 'celebration (rare, never loops)' },
  { name: 'bounce', description: 'landing impacts', when: 'drops, arrival moments' },
];

/* -------------------------------- springs -------------------------------- */

export const SPRINGS: Record<string, SpringSpec> = {
  default: { stiffness: 170, damping: 26, mass: 1 },
  gentle: { stiffness: 120, damping: 18, mass: 1 },
  snappy: { stiffness: 280, damping: 30, mass: 1 },
  smooth: { stiffness: 170, damping: 22, mass: 1.2 },
  bouncy: { stiffness: 220, damping: 14, mass: 1 },
  stiff: { stiffness: 400, damping: 35, mass: 1 },
  heavy: { stiffness: 120, damping: 10, mass: 1.6 },
  floaty: { stiffness: 60, damping: 10, mass: 0.8 },
};

export const spring = (name: string, fallback: SpringSpec = SPRINGS.default): SpringSpec =>
  SPRINGS[name] ?? fallback;

export function springSpec(params?: SpringSpec): SpringSpec {
  return { ...SPRINGS.default, ...params };
}

/* -------------------------------- presets -------------------------------- */

const P = {
  ATTENTION: ['pulse', 'heartBeat', 'pop', 'wobble', 'tada', 'swing', 'jello', 'rubberBand', 'flash', 'shake', 'shakeX', 'shakeY', 'headShake', 'bounceX', 'ring'],
  ENTER: ['fadeIn', 'fadeInUp', 'fadeInDown', 'fadeInLeft', 'fadeInRight', 'fadeInUpBig', 'fadeInDownBig', 'zoomIn', 'zoomInSoft', 'slideUp', 'slideDown', 'slideLeft', 'slideRight', 'flipInX', 'flipInY', 'rotateIn', 'rollIn', 'bounceIn', 'scaleIn', 'dropIn', 'riseIn', 'spinIn', 'popIn', 'stretchIn'],
  EXIT: ['fadeOut', 'fadeOutUp', 'fadeOutDown', 'zoomOut', 'zoomOutSoft', 'slideOutRight', 'slideOutUp', 'slideOutDown', 'scaleOut', 'flipOutX', 'collapse'],
  TEXT: ['typing', 'caret', 'trackingIn', 'revealFrom', 'letterStagger'],
  LOADER: ['shimmer', 'breathe', 'dots', 'bars', 'spin', 'progressStripes'],
} as const;

const b = 1.0;
const easeOut = 'out' as const;
const easeInOut = 'inOut' as const;

export const PRESETS: Record<string, PresetSpec> = {
  /* attention */
  pulse: { mode: 'tween', duration: 900, ease: easeOut, from: { scale: 0.96 }, to: { scale: 1 }, loop: 'mirror', counts: 0 },
  heartBeat: { mode: 'tween', duration: 1100, ease: easeOut, from: { scale: 1 }, to: { scale: 1.08 }, loop: 'loop', counts: 0 },
  pop: { mode: 'spring', spring: SPRINGS.snappy, from: { scale: 1 }, to: { scale: 1.06 }, loop: 'once', counts: 1 },
  wobble: { mode: 'tween', duration: 1100, ease: easeOut, from: { rotate: -4 }, to: { rotate: 4 }, loop: 'mirror', counts: 0 },
  tada: { mode: 'tween', duration: 1000, ease: easeInOut, from: { scale: 1, rotate: -3 }, to: { scale: 1.1, rotate: 3 }, loop: 'mirror', counts: 3 },
  swing: { mode: 'tween', duration: 1000, ease: easeInOut, from: { rotate: 0 }, to: { rotate: 15 }, loop: 'mirror', counts: 4 },
  jello: { mode: 'tween', duration: 1000, ease: easeInOut, from: { scaleX: 1 }, to: { scaleX: 1.25, scaleY: 0.75 }, loop: 'mirror', counts: 3 },
  rubberBand: { mode: 'tween', duration: 1000, ease: easeOut, from: { scaleX: 1, scaleY: 1 }, to: { scaleX: 1.25, scaleY: 0.75 }, loop: 'mirror', counts: 3 },
  flash: { mode: 'tween', duration: 800, ease: 'linear', from: { opacity: 1 }, to: { opacity: 0.2 }, loop: 'mirror', counts: 2 },
  shake: { mode: 'tween', duration: 500, ease: 'linear', distance: 8, loop: 'none', counts: 0 },
  shakeX: { mode: 'tween', duration: 500, ease: 'linear', distance: 10, loop: 'none', counts: 0 },
  shakeY: { mode: 'tween', duration: 500, ease: 'linear', distance: 10, loop: 'none', counts: 0 },
  headShake: { mode: 'tween', duration: 800, ease: easeInOut, from: { rotate: -8 }, to: { rotate: 8 }, loop: 'mirror', counts: 2 },
  bounceX: { mode: 'tween', duration: 700, ease: easeOut, distance: 4, loop: 'mirror', counts: 0 },
  ring: { mode: 'tween', duration: 1300, ease: easeOut, from: { scale: 1, opacity: 0.7 }, to: { scale: 1.6, opacity: 0 }, loop: 'loop', counts: 0 },

  /* enter */
  fadeIn: { mode: 'tween', duration: 320, ease: easeOut, from: { opacity: 0 }, to: { opacity: 1 }, loop: 'once', counts: 1 },
  fadeInUp: { mode: 'tween', duration: 320, ease: easeOut, distance: 24, from: { opacity: 0, y: 24 }, to: { opacity: 1, y: 0 }, loop: 'once', counts: 1 },
  fadeInDown: { mode: 'tween', duration: 320, ease: easeOut, distance: 24, from: { opacity: 0, y: -24 }, to: { opacity: 1, y: 0 }, loop: 'once', counts: 1 },
  fadeInLeft: { mode: 'tween', duration: 320, ease: easeOut, distance: 24, from: { opacity: 0, x: -24 }, to: { opacity: 1, x: 0 }, loop: 'once', counts: 1 },
  fadeInRight: { mode: 'tween', duration: 320, ease: easeOut, distance: 24, from: { opacity: 0, x: 24 }, to: { opacity: 1, x: 0 }, loop: 'once', counts: 1 },
  fadeInUpBig: { mode: 'tween', duration: 600, ease: easeInOut, distance: 96, from: { opacity: 0, y: 96 }, to: { opacity: 1, y: 0 }, loop: 'once', counts: 1 },
  fadeInDownBig: { mode: 'tween', duration: 600, ease: easeInOut, distance: 96, from: { opacity: 0, y: -96 }, to: { opacity: 1, y: 0 }, loop: 'once', counts: 1 },
  zoomIn: { mode: 'tween', duration: 400, ease: easeInOut, from: { opacity: 0, scale: 0.92 }, to: { opacity: 1, scale: 1 }, loop: 'once', counts: 1 },
  zoomInSoft: { mode: 'tween', duration: 500, ease: easeOut, from: { opacity: 0, scale: 0.96 }, to: { opacity: 1, scale: 1 }, loop: 'once', counts: 1 },
  slideUp: { mode: 'tween', duration: 320, ease: easeInOut, distance: 48, from: { y: 48 }, to: { y: 0 }, loop: 'once', counts: 1 },
  slideDown: { mode: 'tween', duration: 320, ease: easeInOut, distance: 48, from: { y: -48 }, to: { y: 0 }, loop: 'once', counts: 1 },
  slideLeft: { mode: 'tween', duration: 320, ease: easeInOut, distance: 48, from: { x: 48 }, to: { x: 0 }, loop: 'once', counts: 1 },
  slideRight: { mode: 'tween', duration: 320, ease: easeInOut, distance: 48, from: { x: -48 }, to: { x: 0 }, loop: 'once', counts: 1 },
  flipInX: { mode: 'tween', duration: 500, ease: easeInOut, from: { rotateX: 90, opacity: 0 }, to: { rotateX: 0, opacity: 1 }, loop: 'once', counts: 1 },
  flipInY: { mode: 'tween', duration: 500, ease: easeInOut, from: { rotateY: 90, opacity: 0 }, to: { rotateY: 0, opacity: 1 }, loop: 'once', counts: 1 },
  rotateIn: { mode: 'tween', duration: 500, ease: easeInOut, from: { rotate: -180, opacity: 0 }, to: { rotate: 0, opacity: 1 }, loop: 'once', counts: 1 },
  rollIn: { mode: 'tween', duration: 500, ease: easeOut, from: { rotate: -120, opacity: 0, x: -48 }, to: { rotate: 0, opacity: 1, x: 0 }, loop: 'once', counts: 1 },
  bounceIn: { mode: 'tween', duration: 700, ease: 'bounceOut', from: { opacity: 0, scale: 0.3 }, to: { opacity: 1, scale: 1 }, loop: 'once', counts: 1 },
  scaleIn: { mode: 'spring', spring: SPRINGS.bouncy, from: { scale: 0 }, to: { scale: 1 }, loop: 'once', counts: 1 },
  dropIn: { mode: 'spring', spring: SPRINGS.heavy, from: { y: -48, opacity: 0 }, to: { y: 0, opacity: 1 }, loop: 'once', counts: 1 },
  riseIn: { mode: 'tween', duration: 600, ease: easeOut, distance: 24, from: { opacity: 0, y: 16 }, to: { opacity: 1, y: 0 }, loop: 'once', counts: 1 },
  spinIn: { mode: 'tween', duration: 700, ease: 'anticipate', from: { rotate: -360, opacity: 0 }, to: { rotate: 0, opacity: 1 }, loop: 'once', counts: 1 },
  popIn: { mode: 'spring', spring: SPRINGS.snappy, from: { scale: 0.6, opacity: 0 }, to: { scale: 1, opacity: 1 }, loop: 'once', counts: 1 },
  stretchIn: { mode: 'tween', duration: 500, ease: easeOut, from: { scaleX: 0.6, scaleY: 0.4, opacity: 0 }, to: { scaleX: 1, scaleY: 1, opacity: 1 }, loop: 'once', counts: 1 },

  /* exit */
  fadeOut: { mode: 'tween', duration: 220, ease: 'in', from: { opacity: 1 }, to: { opacity: 0 }, loop: 'once', counts: 1 },
  fadeOutUp: { mode: 'tween', duration: 220, ease: 'in', distance: 24, from: { opacity: 1, y: 0 }, to: { opacity: 0, y: -24 }, loop: 'once', counts: 1 },
  fadeOutDown: { mode: 'tween', duration: 220, ease: 'in', distance: 24, from: { opacity: 1, y: 0 }, to: { opacity: 0, y: 24 }, loop: 'once', counts: 1 },
  zoomOut: { mode: 'tween', duration: 220, ease: 'in', from: { opacity: 1, scale: 1 }, to: { opacity: 0, scale: 0.92 }, loop: 'once', counts: 1 },
  zoomOutSoft: { mode: 'tween', duration: 320, ease: 'in', from: { opacity: 1, scale: 1, blur: 0 }, to: { opacity: 0, scale: 0.98, blur: 8 }, loop: 'once', counts: 1 },
  slideOutRight: { mode: 'tween', duration: 320, ease: 'in', distance: 96, from: { x: 0 }, to: { x: 96 }, loop: 'once', counts: 1 },
  slideOutUp: { mode: 'tween', duration: 320, ease: 'in', distance: 96, from: { y: 0 }, to: { y: -96 }, loop: 'once', counts: 1 },
  slideOutDown: { mode: 'tween', duration: 320, ease: 'in', distance: 96, from: { y: 0 }, to: { y: 96 }, loop: 'once', counts: 1 },
  scaleOut: { mode: 'tween', duration: 220, ease: 'in', from: { scale: 1 }, to: { scale: 0.8 }, loop: 'once', counts: 1 },
  flipOutX: { mode: 'tween', duration: 400, ease: 'in', from: { rotateX: 0, opacity: 1 }, to: { rotateX: 90, opacity: 0 }, loop: 'once', counts: 1 },
  collapse: { mode: 'tween', duration: 250, ease: easeInOut, from: { scaleY: 1, opacity: 1 }, to: { scaleY: 0, opacity: 0 }, loop: 'once', counts: 1 },

  /* text */
  typing: { mode: 'tween', duration: 200, ease: 'linear', loop: 'none', counts: 0 },
  caret: { mode: 'tween', duration: 800, ease: 'linear', from: { opacity: 1 }, to: { opacity: 0 }, loop: 'mirror', counts: 0 },
  trackingIn: { mode: 'tween', duration: 700, ease: easeOut, distance: 0, loop: 'once', counts: 1 },
  revealFrom: { mode: 'tween', duration: 600, ease: easeOut, distance: 8, from: { opacity: 0, y: 8 }, to: { opacity: 1, y: 0 }, loop: 'once', counts: 1 },
  letterStagger: { mode: 'tween', duration: 320, ease: easeOut, distance: 12, loop: 'once', counts: 1 },

  /* loader */
  shimmer: { mode: 'tween', duration: 1400, ease: 'linear', loop: 'loop', counts: 0 },
  breathe: { mode: 'tween', duration: 1600, ease: easeInOut, from: { opacity: 0.45 }, to: { opacity: 1 }, loop: 'mirror', counts: 0 },
  dots: { mode: 'tween', duration: 600, ease: easeInOut, from: { y: 0, opacity: 0.4 }, to: { y: -6, opacity: 1 }, loop: 'mirror', counts: 0 },
  bars: { mode: 'tween', duration: 800, ease: easeInOut, from: { scaleY: 0.5, opacity: 0.6 }, to: { scaleY: 1, opacity: 1 }, loop: 'mirror', counts: 0 },
  spin: { mode: 'tween', duration: 900, ease: 'linear', from: { rotate: 0 }, to: { rotate: 360 }, loop: 'loop', counts: 0 },
  progressStripes: { mode: 'tween', duration: 900, ease: 'linear', loop: 'loop', counts: 0 },
};

export const PRESET_GROUPS = P;

export type PresetName = string;

/** Resolve a preset by name; missing presets throw so config errors surface early. */
export function resolvePreset(name: string): PresetSpec {
  const spec = PRESETS[name];
  if (!spec) throw new Error(`WCO motion: unknown preset "${name}"`);
  return { ...spec, from: spec.from ? { ...spec.from } : undefined, to: spec.to ? { ...spec.to } : undefined };
}

export const presetNames = (): string[] => Object.keys(PRESETS);

/** Presets that visibly move on the X axis (for shake/announcement families). */
export function isShakePreset(name: string): boolean {
  return name === 'shake' || name === 'shakeX' || name === 'bounceX';
}

export const countsOf = (spec: PresetSpec): number => spec.counts ?? 1;
export const loopOf = (spec: PresetSpec): LoopMode => spec.loop ?? 'none';