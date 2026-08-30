/**
 * WCO Animation System — "Motion that means something."
 *
 * Every animation in WCO earns its place: it clarifies a relationship,
 * celebrates a win, or guides recovery. We obey a strict motion budget so the
 * UI feels alive at 60fps on low-end Android, never flustered.
 *
 * This file codifies:
 * - `durations`  — the canonical speed scale (the *closest* distance wins).
 * - `easings`    — physical, crafted curves. Standard is the workhorse;
 *   entrance is eager; exit is decisive; spring is for delight only.
 * - `steps`      — named, reusable *presets* (property + duration + easing +
 *   delay) that components reference instead of hand-rolled transitions.
 * - `keyframes`  — CSS @keyframes recipes for the animation primitives
 *   (enter/exit, pulse, shimmer, toast, celebrate, skeleton, reveal).
 * - `reducedMotion` — values we swap to when `prefers-reduced-motion` is set.
 * - `principles` — the 10 rules that govern *why* a value is used.
 *
 * Motion budget (enforced in review + CI): transforms/opacity only,
 * composite-friendly, nothing that triggers layout. Every preset ≤ the
 * `deliberate` ceiling.
 */
import { duration, easing, motion as baseMotion } from './layout';

/** Canonical speed scale (distance-aware). */
export const durations = {
  /** Instant feedback for a press/tap ripple — no perceptible wait. */
  instant: duration.instant, // 0ms
  /** Micro "did it respond?" — hover, press, focus, drag-start. */
  micro: '100ms',
  /** Fast state change — color, border, small scale. */
  fast: duration.fast, // 120ms
  /** The workhorse state transition — 60fps, imperceptible lag. */
  base: duration.base, // 200ms
  /** Moderate reposition — panel slide, list reorder. */
  moderate: duration.moderate, // 280ms
  /** Distance travel — modal enter, drawer, page transition. */
  slow: duration.slow, // 400ms
  /** Larger reveals — toast, celebrate, sheet collapse. */
  slower: duration.slower, // 650ms
  /** Long, deliberate — confetti trail, onboarding flourish. */
  deliberate: duration.deliberate, // 900ms
} as const;

/** Physical, crafted easing curves. */
export const easings = {
  /** The workhorse: symmetric, calm, trusty. */
  standard: easing.standard,
  /** Eager entrance — decelerate into place (feels like arrival). */
  emphasized: easing.emphasized,
  /** Decisive exit — accelerate away (feels intentional). */
  exit: easing.exit,
  /** Delight only — overshoot + settle (confetti, celebration). */
  spring: easing.springy,
  /** Machine-drift — progress, indeterminate bars, autoplay. */
  linear: easing.linear,
  /** Gentle deceleration for large parallax / hero motion. */
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  /** Sharp snap-out for toggles that must feel instant. */
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  /** Spring-in with a tiny overshoot (buttons, chips). */
  bounceIn: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Smooth settle after bounce. */
  easeOutQuint: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Staggered-enter friendly ease for lists. */
  easeInOutQuad: 'cubic-bezier(0.45, 0, 0.55, 1)',
} as const;

export type EasingName = keyof typeof easings;
export type DurationName = keyof typeof durations;

/**
 * Named motion steps components reuse. `name` → `{ duration, easing, delay }`.
 * Durations & easings come from the scale above — never ad-hoc.
 */
export const steps = {
  /** Hover / focus tint. */
  hover: { property: 'background-color, color, border-color', duration: durations.micro, easing: easings.standard },
  /** Press-down scale. */
  press: { property: 'transform', duration: durations.micro, easing: easings.standard },
  /** Button primary state. */
  button: { property: 'background-color, color, border-color, box-shadow', duration: durations.fast, easing: easings.standard },
  /** Card hover lift. */
  cardLift: { property: 'transform, box-shadow', duration: durations.fast, easing: easings.easeOutQuint },
  /** Input focus ring reveal. */
  focusRing: { property: 'box-shadow, border-color', duration: durations.fast, easing: easings.standard },
  /** Modal / drawer overlay fade. */
  overlay: { property: 'opacity', duration: durations.moderate, easing: easings.standard },
  /** Modal / drawer panel enter. */
  panelEnter: { property: 'transform, opacity', duration: durations.slow, easing: easings.emphasized },
  /** Toast in. */
  toastIn: { property: 'transform, opacity', duration: durations.slower, easing: easings.bounceIn },
  /** List item stagger enter. */
  listStagger: { property: 'transform, opacity', duration: durations.moderate, easing: easings.easeInOutQuad },
  /** Success celebration pop. */
  celebrate: { property: 'transform, opacity', duration: durations.slower, easing: easings.spring },
  /** Skeleton shimmer. */
  shimmer: { property: 'transform', duration: durations.slower, easing: easings.linear },
  /** Focus-visible ring. */
  focusVisible: { property: 'outline, box-shadow', duration: durations.fast, easing: easings.standard },
} as const;

/**
 * CSS @keyframes recipes (translate → composable `animation` shorthand).
 * Host CSS defines the actual keyframes; these are the canonical timings.
 */
export const keyframes = {
  fadeIn: {
    name: 'wco-fade-in',
    duration: durations.fast,
    easing: easings.emphasized,
    fill: 'both',
  },
  fadeInScale: {
    name: 'wco-fade-in-scale',
    duration: durations.moderate,
    easing: easings.emphasized,
    fill: 'both',
  },
  slideUp: {
    name: 'wco-slide-up',
    duration: durations.moderate,
    easing: easings.emphasized,
    fill: 'both',
  },
  slideDown: {
    name: 'wco-slide-down',
    duration: durations.moderate,
    easing: easings.emphasized,
    fill: 'both',
  },
  slideInRight: {
    name: 'wco-slide-in-right',
    duration: durations.moderate,
    easing: easings.standard,
    fill: 'both',
  },
  slideInBottom: {
    name: 'wco-slide-in-bottom',
    duration: durations.slow,
    easing: easings.emphasized,
    fill: 'both',
  },
  pop: {
    name: 'wco-pop',
    duration: durations.moderate,
    easing: easings.spring,
    fill: 'both',
  },
  pulse: {
    name: 'wco-pulse',
    duration: durations.slower,
    easing: easings.standard,
    fill: 'none',
    iteration: 'infinite',
  },
  shimmer: {
    name: 'wco-shimmer',
    duration: durations.slower,
    easing: easings.linear,
    fill: 'both',
    iteration: 'infinite',
  },
  skeleton: {
    name: 'wco-skeleton',
    duration: durations.slower,
    easing: easings.linear,
    fill: 'both',
    iteration: 'infinite',
  },
  spin: {
    name: 'wco-spin',
    duration: '800ms',
    easing: easings.linear,
    iteration: 'infinite',
  },
  celebrate: {
    name: 'wco-celebrate',
    duration: durations.slower,
    easing: easings.spring,
    fill: 'both',
  },
  ripple: {
    name: 'wco-ripple',
    duration: durations.slower,
    easing: easings.easeOutQuint,
    fill: 'both',
  },
} as const;

/**
 * `prefers-reduced-motion` override map. When a user requests reduced motion
 * we collapse *expressive* motion to a near-zero instant and keep only
 * opacity cross-fades (never transforms that imply travel). This preserves
 * feedback without triggering vestibular discomfort.
 */
export const reducedMotion = {
  durations: {
    ...durations,
    micro: '0.01ms',
    fast: '0.01ms',
    base: '0.01ms',
    moderate: '0.01ms',
    slow: '0.01ms',
    slower: '0.01ms',
    deliberate: '0.01ms',
  },
  /** A curated set of still-safe effects (opacity cross-fade only). */
  safeSteps: {
    hover: { property: 'opacity', duration: '0.01ms', easing: easings.linear },
    button: { property: 'opacity', duration: '0.01ms', easing: easings.linear },
    overlay: { property: 'opacity', duration: '0.01ms', easing: easings.linear },
    panelEnter: { property: 'opacity', duration: '0.01ms', easing: easings.linear },
    toastIn: { property: 'opacity', duration: '0.01ms', easing: easings.linear },
  },
} as const;

/** The 10 motion principles — actionable, measurable, mapped to WCO. */
export const principles = [
  { rule: 'Every motion has a job.', action: 'Motions clarify, celebrate, or recover. Decorative drift is deleted.', measure: 'No keyframe lacks a documented role.', wco: 'Payout success pops; a failed send eases down with a hint.' },
  { rule: 'Closest motion wins.', action: 'Prefer opacity + transform over layout; the shortest distance that reads.', measure: 'Every preset uses transform/opacity only.', wco: 'Buttons scale 0.985, never collapse the row.' },
  { rule: 'Respect the 60fps contract.', action: 'Composite-only, `will-change` sparingly, no layout thrash.', measure: '95th-percentile frame budget met on a $100 Android.', wco: 'Chat scroll, list reorder, and toasts stay buttery on 3G phones.' },
  { rule: 'Honor reduced motion.', action: 'Swap expressive motion to a 0.01ms opacity cross-fade.', measure: '`prefers-reduced-motion` collapses all travel.', wco: 'A merchant with vestibular sensitivity gets the same information, still.' },
  { rule: 'Micro-moments feel physical.', action: 'Press, hover, focus each have a fast crafted curve.', measure: 'Every interactive element < 200ms initial response.', wco: 'Every button/toggle/checkbox has a tactile press scale.' },
  { rule: 'Enter is eager, exit is decisive.', action: 'Entrance decelerates; exit accelerates. Never lazy-bounce-away.', measure: 'Entrance == emphasized; exit == exit curve.', wco: 'Modals arrive, drawers leave with purpose.' },
  { rule: 'Stagger, don’t sync.', action: 'Lists enter in short staggered steps, not all at once.', measure: 'Stagger offset ≤ 48ms; total ≤ 400ms.', wco: 'Metric cards cascade into the dashboard.' },
  { rule: 'Celebrate wins with restraint.', action: 'One signature moment (scale + a pulse) — then stop.', measure: 'Celebrations ≤ 900ms and non-looping.', wco: 'First payout: a single confetti pop, then calm.' },
  { rule: 'Loading is designed, never default.', action: 'Skeleton + shimmer with real shape, plus a live try-again.', measure: 'Every async surface has a skeleton, not a spinner rosetta.', wco: 'Conversations show chat-shaped skeletons, not a lone spinner.' },
  { rule: 'Motion budgets are sacred.', action: 'Keep durations within the scale; never exceed `deliberate`.', measure: 'Lint/CI gates: no duration outside the scale.', wco: 'We ship calm, trustworthy speed — the opposite of frantic.' },
] as const;

export type WcoAnimationTokens = {
  durations: typeof durations;
  easings: typeof easings;
  steps: typeof steps;
  keyframes: typeof keyframes;
  reducedMotion: typeof reducedMotion;
  principles: typeof principles;
};

export const animation = {
  durations,
  easings,
  steps,
  keyframes,
  reducedMotion,
  principles,
} as const;

/** Back-compat: the existing `motion` presets from layout still apply. */
export const motion = baseMotion;
