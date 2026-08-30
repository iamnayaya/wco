/**
 * WCO Effects & Adaptive Color — "Atmosphere, not decoration."
 *
 * Effects are progressive enhancement: they never carry information, never
 * hurt contrast, and dissolve gracefully in reduced-motion / reduced-transparency
 * and on low-end devices. They give WCO its "handcrafted, alive" aura.
 *
 * This file codifies:
 * - `gradients`   — the branded gradient recipes (Sun→Ember→Clay).
 * - `glass`       — glassmorphism primitives (blur + translucent surfaces).
 * - `dynamic`     — context-aware / time-of-day / user-preference palettes.
 * - `cultural`    — the market accent ramp (fills color.ts `cultural` with a
 *   full ramp + light/dark + online/offline states per market).
 * - `focus`       — the visible-focus tokens (AAA visible focus ring).
 * - `motion`      — reduced-transparency / reduced-motion safe defaults.
 * - `blur`        — backdrop blur radii.
 */
import { brand, sun, clay, cultural } from './color';
import { radii } from './layout';

/** Branded gradient recipes — all maintain WCAG AA for large UI + AAA text. */
export const gradients = {
  /** Wordmark / hero background wash. */
  brandWash: `linear-gradient(120deg, ${brand['50']}, ${sun['50']} 55%, ${clay['100']})`,
  /** Primary CTA sheen (subtle; on top of a solid primary). */
  primarySheen: `linear-gradient(180deg, ${brand['400']} 0%, ${brand['600']} 100%)`,
  /** High-energy CTA (Sun). */
  sunSheen: `linear-gradient(180deg, ${sun['400']} 0%, ${sun['500']} 100%)`,
  /** Hero title text gradient (decorative, on dark). */
  title: `linear-gradient(120deg, ${brand['300']}, ${sun['300']} 60%, ${clay['400']})`,
  /** Insight/AI highlight. */
  insight: `linear-gradient(120deg, ${brand['500']}, ${brand['600']})`,
  /** Semantic success sheen. */
  success: `linear-gradient(180deg, #34d399, #059669)`,
  /** Semantic danger sheen. */
  danger: `linear-gradient(180deg, #f87171, #dc2626)`,
} as const;

/** Backdrop blur radii (px). */
export const blur = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 32,
} as const;

/**
 * Glassmorphism primitives — translucent + blurred surfaces. Glass must be
 * *progressive enhancement*: below a 60fps/feature budget we fall back to
 * solid `surface` (see `glass.safe`).
 */
export const glass = {
  /** Translucent card over imagery/overlay. */
  card: { background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.45)', backdropFilter: `blur(${blur.lg}px)`, WebkitBackdropFilter: `blur(${blur.lg}px)`, borderRadius: radii.lg },
  /** Sticky navbar. */
  navbar: { background: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.3)', backdropFilter: `blur(${blur.md}px)`, WebkitBackdropFilter: `blur(${blur.md}px)` },
  /** Floating action / sheet surface. */
  raised: { background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.5)', backdropFilter: `blur(${blur.xl}px)`, WebkitBackdropFilter: `blur(${blur.xl}px)`, borderRadius: radii['2xl'] },
  /** Dark-mode glass (cool, low-alpha). */
  dark: { background: 'rgba(11,17,32,0.72)', border: '1px solid rgba(148,163,184,0.2)', backdropFilter: `blur(${blur.lg}px)`, WebkitBackdropFilter: `blur(${blur.lg}px)` },
  /** Fallback for low-power / reduced-transparency devices. */
  safe: { background: 'var(--wco-surface, #ffffff)', border: '1px solid var(--wco-border, #e2e8f0)' },
} as const;

/**
 * Dynamic color — context, time-of-day, and user preference.
 * Time-of-day themes are poetic but must never harm readability; they only
 * tint neutrals via the `--wco-*` layer and are progressive enhancement.
 */
export const dynamic = {
  /** Time-of-day "ambience" accents (subtle surfaced tints). */
  timeOfDay: {
    dawn: { accent: sun['400'], tint: 'rgba(245,158,11,0.06)' },
    day: { accent: brand['600'], tint: 'rgba(16,185,129,0.06)' },
    dusk: { accent: clay['500'], tint: 'rgba(207,101,69,0.08)' },
    night: { accent: brand['400'], tint: 'rgba(16,185,129,0.08)' },
  } as const,
  /** User-preference accent (e.g. from settings) as a token bucket. */
  preference: { calm: brand['600'], warm: sun['600'], earthy: clay['600'], royal: '#7c3aed', rose: '#be123c' } as const,
  /** Data-driven: accent that lifts/softens based on a ratio (0–1). */
  intensity: {
    low: brand['200'],
    medium: brand['400'],
    high: brand['600'],
    max: brand['800'],
  } as const,
} as const;

/**
 * Cultural ramp — one full accent ramp per market, plus online/offline
 * states. Fills the single-accent `cultural` map from color.ts with a ramp.
 * Designed so text-on-surface stays AAA.
 */
export const culturalRamp = {
  nigeria: { accent: sun['600'], ramp: sun, label: 'Sun — vitality' },
  ghana: { accent: brand['600'], ramp: brand, label: 'Ember — growth' },
  kenya: { accent: '#be123c', ramp: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337', 950: '#4c0519' }, label: 'Rose — vitality' },
  southAfrica: { accent: '#6d28d9', ramp: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95', 950: '#2e1065' }, label: 'Violet — ambition' },
} as const;

/** Visible-focus tokens — every interactive element must show a clear ring. */
export const focus = {
  /** 2px solid ring, 2px offset — visible on any background. */
  ring: '2px solid var(--wco-ring, #059669)',
  ringOffset: '2px',
  /** Alternative thick ring for high-contrast/force-focus users. */
  highContrast: '3px solid CanvasText',
  /** Dual-ring (outer contrast on dark). */
  dark: '2px solid var(--wco-ring, #34d399)',
} as const;

export type WcoEffectsTokens = {
  gradients: typeof gradients;
  blur: typeof blur;
  glass: typeof glass;
  dynamic: typeof dynamic;
  culturalRamp: typeof culturalRamp;
  focus: typeof focus;
};

export const effects = {
  gradients,
  blur,
  glass,
  dynamic,
  culturalRamp,
  focus,
} as const;

/** Re-export for convenience in consumer orchestrations. */
export { cultural };
