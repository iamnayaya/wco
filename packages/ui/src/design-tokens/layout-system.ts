/**
 * WCO Layout System — "Structure that disappears."
 *
 * The grid is the quiet skeleton behind every screen. It resolves at five
 * breakpoints, is fluid (no fixed-pixel assumptions → AR/VR and foldables
 * just work), and uses a whitespace philosophy that lets content breathe.
 *
 * This file codifies:
 * - `breakpoints` — the five canonical widths, in px and as media-query
 *   strings (mobile-first `min-width`).
 * - `grid`        — column counts per breakpoint, gutter, and the interstitial
 *   `container` widths.
 * - `containers`  — the max-width "page rails" (narrow, prose, app, wide).
 * - `whitespace`  — the section/component rhythm tokens (see `space` in
 *   layout.ts for the micro scale; these are the macro rhythm).
 * - `semantics`   — named layout regions mapped to the grid so any screen can
 *   be composed from the same scaffolding.
 *
 * Philosophy:
 * - Mobile-first: start at 4 columns, 16px gutter; scale up, never down.
 * - Generous macro whitespace (≥ 80px section rhythm on desktop) so dense
 *   commerce screens read calm.
 * - Never fight the grid: alignment is a feature.
 */

/** Canonical breakpoints in px (mobile-first). */
export const breakpoints = {
  /** Small phones / narrow viewports (360–639). Base. */
  sm: 640,
  /** Large phones / small tablets (640–767). */
  md: 768,
  /** Tablets & small laptops (768–1023). */
  lg: 1024,
  /** Laptops / desktops (1024–1279). */
  xl: 1280,
  /** Large desktop / ultrawide (1280+). */
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/** Mobile-first media-query strings (min-width). */
export const media = Object.fromEntries(
  Object.entries(breakpoints).map(([name, px]) => [name, `(min-width: ${px}px)`]),
) as Record<Breakpoint, string>;

/** The grid scale per breakpoint. */
export const grid = {
  columns: {
    base: 4,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 12,
    '2xl': 16,
  } as const,
  /** Gutter in px (the spacing between columns) — token-aligned (16px). */
  gutter: 16,
  /** Outer page margin at each breakpoint (px). */
  margin: { base: 16, sm: 16, md: 24, lg: 32, xl: 40, '2xl': 48 } as const,
} as const;

/** Fluid container widths (max-width, px) — the "page rails". */
export const containers = {
  /** Narrow single-column — wizards, verification, prose. */
  narrow: 480,
  /** Prose / reading column — landing copy, docs. */
  prose: 680,
  /** Standard app rail — dashboards, tables. */
  app: 1200,
  /** Wide data rail — analytics, analytics reports. */
  wide: 1440,
} as const;

export type Container = keyof typeof containers;

/**
 * Macro whitespace rhythm (px). `space` in layout.ts covers micro (4–256);
 * these are the *section*-level intervals that create calm.
 */
export const whitespace = {
  /** Tight section grouping — related cards. */
  sectionXs: 24,
  /** Standard section rhythm on mobile. */
  sectionSm: 40,
  /** Standard section rhythm on desktop. */
  sectionMd: 64,
  /** Hero / major break in the layout. */
  sectionLg: 96,
  /** Full page-break / closing distance. */
  sectionXl: 128,
  /** Screen-padding used inside dashboards. */
  pagePad: { base: 16, sm: 16, md: 24, lg: 32 } as const,
} as const;

/** Named layout regions → how they map to the grid. */
export const semantics = {
  /** The whole page scroll container. */
  page: 'Page',
  /** Primary app rail on xl+ → `app` container, centered. */
  appRail: 'AppRail',
  /** Two-pane (sidebar + content) composition. */
  twoPane: 'TwoPane',
  /** Three-pane (nav + list + detail) — e.g. conversations. */
  threePane: 'ThreePane',
  /** Data toolbar + table region. */
  dataRegion: 'DataRegion',
  /** Focused single decisions (modals/dialogs). */
  focused: 'Focused',
} as const;

/** Helper: returns the fluid grid config for a given viewport width. */
export function gridFor(width: number) {
  const order: Breakpoint[] = ['sm', 'md', 'lg', 'xl', '2xl'];
  let active: Breakpoint = 'sm';
  for (const b of order) {
    if (width >= breakpoints[b]) active = b;
    else break;
  }
  const matched = active === 'sm' && width < breakpoints.sm ? 'base' : active;
  return {
    columns: grid.columns[matched as keyof typeof grid.columns],
    gutter: grid.gutter,
    margin: grid.margin[matched as keyof typeof grid.margin],
  };
}

export type WcoLayoutSystemTokens = {
  breakpoints: typeof breakpoints;
  media: typeof media;
  grid: typeof grid;
  containers: typeof containers;
  whitespace: typeof whitespace;
  semantics: typeof semantics;
};

export const layoutSystem = {
  breakpoints,
  media,
  grid,
  containers,
  whitespace,
  semantics,
} as const;
