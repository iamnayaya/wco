/**
 * WCO Icon System — "One set, many voices."
 *
 * A single, internally-consistent icon vocabulary across web, mobile, and
 * (soon) spatial. Icons are semantic first: every glyph maps to a named
 * token, so swapping weight or swapping a full icon set never ripples through
 * the product.
 *
 * This file codifies:
 * - `names`      — every icon name in the WCO vocabulary (semantic, not
 *   pixel-described: `inboxRead`, not `doubleCheck`).
 * - `sizes`      — the canonical size steps (16 → 64), with the UI default 24.
 * - `weights`    — light / regular / bold, corresponding stroke widths.
 * - `states`     — how each interactive state changes the glyph's appearance.
 * - `animation`  — the subtle, purposeful micro-motion families (pulse,
 *   confirmation pop, spinner spin, etc.).
 * - `a11y`       — guidance + helper for ARIA labeling.
 *
 * Rendering: icons are delivered as a runtime `<Icon>` component backed by
 * this registry (see packages/ui components). The registry binds name →
 * SVG path data so weights/state animations stay centralized.
 */

/** The full WCO icon vocabulary. Grouped by domain for easy reference. */
export const names = [
  // Commerce / catalogue
  'product', 'inventory', 'category', 'cart', 'checkout', 'order', 'refund',
  'discount', 'priceTag', 'barcode', 'warehouse', 'shipping',
  // Payments & money
  'wallet', 'card', 'cash', 'payout', 'invoice', 'currency', 'mobileMoney',
  'bank', 'receipt', 'tax',
  // Messaging & customers
  'chat', 'conversation', 'inbox', 'inboxUnread', 'inboxRead', 'broadcast',
  'customer', 'contact', 'segments', 'reaction', 'attachment', 'template',
  'autoReply',
  // Analytics & insight
  'chartLine', 'chartBar', 'chartPie', 'chartFunnel', 'trendUp', 'trendDown',
  'insight', 'target', 'report', 'export', 'history', 'calendar',
  // Navigation & actions
  'home', 'grid', 'search', 'plus', 'minus', 'close', 'check', 'chevronDown',
  'chevronUp', 'chevronRight', 'chevronLeft', 'arrowUp', 'arrowDown',
  'arrowRight', 'arrowLeft', 'more', 'moreVertical', 'menu', 'settings',
  'filter', 'sort', 'edit', 'trash', 'copy', 'download', 'upload', 'share',
  'link', 'external', 'refresh', 'undo', 'redo', 'save', 'print',
  // Status & feedback
  'info', 'success', 'warning', 'error', 'question', 'alert', 'help',
  'notification', 'bell', 'shield', 'lock', 'eye', 'eyeOff', 'verified',
  // AI & automation
  'ai', 'sparkles', 'magic', 'bot', 'automation', 'prediction', 'priority',
  // People & identity
  'user', 'users', 'team', 'avatar', 'role', 'permission', 'key', 'fingerprint',
  // Communication & media
  'phone', 'voice', 'video', 'camera', 'image', 'mic', 'emoji', 'globe',
  'language', 'location', 'store',
  // Objects & misc
  'clock', 'star', 'heart', 'flag', 'folder', 'file', 'bookmark', 'gift',
  'zap', 'anchor', 'sun', 'moon', 'device', 'web', 'mobile',
] as const;

export type IconName = (typeof names)[number];

/** Canonical icon size steps (px). `md` (24) is the UI default. */
export const sizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
  '2xl': 64,
} as const;

export type IconSize = keyof typeof sizes;

/** Stroke weight voices. */
export const weights = {
  /** 1.5px — airy, refined. For large, sparse glyphs and hover idle. */
  light: 1.5,
  /** 1.75px — default. Balanced, crisp at 24 and smaller. */
  regular: 1.75,
  /** 2.25px — confident. For active nav, primary actions, offline-first. */
  bold: 2.25,
} as const;

export type IconWeight = keyof typeof weights;

/** Interactive-state recipe for icon glyphs. */
export const states = {
  default: 'currentColor',
  hover: 'currentColor', // color changes via parent; icon adds a 6% lift
  active: { color: 'currentColor', transform: 'scale(1.12)' },
  disabled: { opacity: 0.42 },
  focused: 'currentColor', // ring handled by the control, not the glyph
} as const;

/** Subtle, purposeful micro-motion families. Purely presentational. */
export const animation = {
  spin: { name: 'wco-spin', duration: '800ms', easing: 'linear', iteration: 'infinite' },
  pulse: { name: 'wco-icon-pulse', duration: '1.6s', easing: 'ease-in-out', iteration: 'infinite' },
  /** Confirmation pop for a "read"/"verified"/"success" tick. */
  pop: { name: 'wco-pop', duration: '400ms', easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'both' },
  /** Gentle attention bounce for a notification bell with a fresh item. */
  ring: { name: 'wco-icon-ring', duration: '900ms', easing: 'ease-in-out', iteration: 'infinite' },
} as const;

/**
 * ARIA helper: icons are decorative by default (sibling text carries meaning).
 * Pass an `aria-label` (or the component's `title`) only when the icon is the
 * *only* cue — e.g. icon-only buttons. Returns an object to spread.
 */
export function iconA11y(props: { label?: string; describedBy?: string } = {}) {
  if (!props.label) return { 'aria-hidden': true as const, focusable: false as const };
  return { 'aria-label': props.label, role: 'img' as const };
}

/** Ship a lookup for "does this name exist" — helps editors autocomplete. */
export const isIconName = (x: unknown): x is IconName =>
  typeof x === 'string' && (names as readonly string[]).includes(x);

export type WcoIconTokens = {
  names: typeof names;
  sizes: typeof sizes;
  weights: typeof weights;
  states: typeof states;
  animation: typeof animation;
};

export const icons = {
  names,
  sizes,
  weights,
  states,
  animation,
} as const;
