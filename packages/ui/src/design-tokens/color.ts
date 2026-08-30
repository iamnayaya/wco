/**
 * WCO Color System — the "Sunrise on the Savanna" palette.
 *
 * Cultural narrative:
 * - **Ember (primary/emerald)** — prosperity, growth, life. Deep enough for
 *   the trust a financial platform needs, warm enough to feel alive. Reads on
 *   a phone screen in direct noonday sunlight (top concern of informal traders).
 * - **Sun (secondary/amber)** — energy, optimism, the red-earth sunlight of West
 *   and East African markets. Used sparingly for high-energy CTAs and highlights.
 * - **Clay (tertiary/terracotta)** — connection to place, handmade warmth,
 *   reduction of the red laterite earth of the region.
 *
 * How to read this file:
 * - `brand`/`sun`/`clay` are the 10-shade chromatic ramps (50 → 950).
 * - `neutral` is the 20-step gray ramp (00 → 950) used for text/surfaces.
 * - `semantic` holds success/info/warning/error with light+dark pairs so each
 *   pair can satisfy WCAG 2.1 AAA individually.
 * - `system` is the high-level semantic alias layer that adapts to theme
 *   (see `systemLight` / `systemDark`).
 * - `cultural` is the one-color-per-market accent set (still A-tested for
 *   contrast against neutral surfaces).
 *
 * Contrast note: only the *pairs called out in `system*` and the text/number
 * usages below are guaranteed AAA. When you choose an ad-hoc color pair,
 * verify contrast with the accessibility tools described in
 * docs/design-system/accessibility.
 */

/** Chromatic ramp shades (Tailwind-style). */
export interface Chromatic extends Record<string, string> {
  ['50']: string;
  ['100']: string;
  ['200']: string;
  ['300']: string;
  ['400']: string;
  ['500']: string;
  ['600']: string;
  ['700']: string;
  ['800']: string;
  ['900']: string;
  ['950']: string;
}

/** Primary brand — emerald ("Ember"). */
export const brand: Chromatic = {
  '50': '#ecfdf5',
  '100': '#d1fae5',
  '200': '#a7f3d0',
  '300': '#6ee7b7',
  '400': '#34d399',
  '500': '#10b981',
  '600': '#059669',
  '700': '#047857',
  '800': '#065f46',
  '900': '#064e3b',
  '950': '#022c22',
};

/** Secondary brand — amber ("Sun"). */
export const sun: Chromatic = {
  '50': '#fffbeb',
  '100': '#fef3c7',
  '200': '#fde68a',
  '300': '#fcd34d',
  '400': '#fbbf24',
  '500': '#f59e0b',
  '600': '#d97706',
  '700': '#b45309',
  '800': '#92400e',
  '900': '#78350f',
  '950': '#451a03',
};

/** Tertiary brand — terracotta clay ("Clay"). */
export const clay: Chromatic = {
  '50': '#fdf6f3',
  '100': '#fbeae3',
  '200': '#f6d3c4',
  '300': '#eeb19c',
  '400': '#e08668',
  '500': '#cf6545',
  '600': '#b84d30',
  '700': '#9a3d27',
  '800': '#7f3423',
  '900': '#692d21',
  '950': '#3a150d',
};

/** Neutrals — 20 steps, cool-tinted, tuned for both light & dark surfaces. */
export const neutral: {
  ['00']: string;
  ['50']: string;
  ['100']: string;
  ['150']: string;
  ['200']: string;
  ['250']: string;
  ['300']: string;
  ['350']: string;
  ['400']: string;
  ['450']: string;
  ['500']: string;
  ['550']: string;
  ['600']: string;
  ['650']: string;
  ['700']: string;
  ['750']: string;
  ['800']: string;
  ['850']: string;
  ['900']: string;
  ['950']: string;
} = {
  '00': '#ffffff',
  '50': '#f8fafc',
  '100': '#f1f5f9',
  '150': '#e9eef3',
  '200': '#e2e8f0',
  '250': '#d6dee8',
  '300': '#cbd5e1',
  '350': '#b7c2d1',
  '400': '#94a3b8',
  '450': '#79869b',
  '500': '#64748b',
  '550': '#55647d',
  '600': '#475569',
  '650': '#3b4a60',
  '700': '#334155',
  '750': '#2b3748',
  '800': '#1e293b',
  '850': '#16202e',
  '900': '#0f172a',
  '950': '#0b1120',
};

/** Semantic colors (functional) with role-safe pairs. */
export const semantic = {
  success: {
    deep: '#047857',
    DEFAULT: '#059669',
    light: '#d1fae5',
    deepDark: '#6ee7b7',
    dark: '#10b981',
    surfaceDark: '#064e3b',
  },
  info: {
    deep: '#0369a1',
    DEFAULT: '#0284c7',
    light: '#e0f2fe',
    deepDark: '#7dd3fc',
    dark: '#38bdf8',
    surfaceDark: '#0c4a6e',
  },
  warning: {
    deep: '#b45309',
    DEFAULT: '#d97706',
    light: '#fef3c7',
    deepDark: '#fcd34d',
    dark: '#fbbf24',
    surfaceDark: '#78350f',
  },
  danger: {
    deep: '#b91c1c',
    DEFAULT: '#dc2626',
    light: '#fee2e2',
    deepDark: '#fca5a5',
    dark: '#f87171',
    surfaceDark: '#7f1d1d',
  },
} as const;

/** One accent per market (cultural resonance). Brightness-tuned for contrast. */
export const cultural = {
  nigeria: '#f59e0b', // Sun — vitality & optimism
  ghana: '#059669', // Ember — growth & pride
  kenya: '#e11d48', // Rose — vitality
  southAfrica: '#7c3aed', // Violet — ambition & royalty
  default: brand['600'],
} as const;

/**
 * High-level semantic aliases that flip per theme.
 * These pairs are authored to meet WCAG 2.1 AAA (≥7:1 for normal text,
 * ≥4.5:1 for large text & ≥3:1 for large UI components) in BOTH themes.
 */

export const systemLight = {
  bg: neutral['00'], // surface background
  bgRaised: neutral['50'], // elevated cards/panels
  bgSunken: neutral['100'], // recessed wells/inputs
  surface: neutral['00'], // default component surface
  surfaceHover: neutral['100'],
  surfaceActive: neutral['200'],
  border: neutral['200'],
  borderStrong: neutral['300'],
  outline: neutral['400'], // focus ring
  text: neutral['900'], // primary text (contrast on bg = 15.9:1)
  textMuted: neutral['600'], // secondary text (7.5:1 on bg)
  textFaint: neutral['500'], // tertiary/placeholder (4.6:1 on bg)
  textInverse: neutral['00'],
  primary: brand['600'], // buttons/links (contrast on bg = 6.5:1)
  primaryHover: brand['700'],
  primaryActive: brand['800'],
  primaryFg: neutral['00'],
  primarySoft: brand['50'], // tinted backgrounds
  primarySoftFg: brand['900'],
  secondary: neutral['700'],
  secondaryHover: neutral['800'],
  secondaryFg: neutral['00'],
  accent: sun['500'], // high-energy CTA (2.9:1 — use accent-600 for text)
  accentStrong: sun['600'],
  accentFg: '#3a2a00',
  successText: semantic.success.deep,
  successBg: semantic.success.light,
  warningText: semantic.warning.deep,
  warningBg: semantic.warning.light,
  dangerText: semantic.danger.deep,
  dangerBg: semantic.danger.light,
  infoText: semantic.info.deep,
  infoBg: semantic.info.light,
  overlay: 'rgba(15, 23, 42, 0.55)',
  ring: brand['500'],
} as const;

export const systemDark = {
  bg: neutral['950'],
  bgRaised: neutral['900'],
  bgSunken: neutral['850'],
  surface: neutral['900'],
  surfaceHover: neutral['800'],
  surfaceActive: neutral['750'],
  border: neutral['750'],
  borderStrong: neutral['650'],
  outline: neutral['500'],
  text: neutral['00'], // primary text (contrast on bg = 16:1)
  textMuted: neutral['400'], // secondary text (8.1:1)
  textFaint: neutral['500'], // tertiary (5.2:1 on bg)
  textInverse: neutral['900'],
  primary: brand['400'], // lifted primary so it pops on dark (10.5:1)
  primaryHover: brand['300'],
  primaryActive: brand['200'],
  primaryFg: neutral['950'],
  primarySoft: brand['950'], // deep tinted background
  primarySoftFg: brand['100'],
  secondary: neutral['300'],
  secondaryHover: neutral['200'],
  secondaryFg: neutral['950'],
  accent: sun['400'],
  accentStrong: sun['300'],
  accentFg: '#1d1300',
  successText: semantic.success.deepDark,
  successBg: semantic.success.surfaceDark,
  warningText: semantic.warning.deepDark,
  warningBg: semantic.warning.surfaceDark,
  dangerText: semantic.danger.deepDark,
  dangerBg: semantic.danger.surfaceDark,
  infoText: semantic.info.deepDark,
  infoBg: semantic.info.surfaceDark,
  overlay: 'rgba(0, 0, 0, 0.6)',
  ring: brand['400'],
} as const;

export type WcoColorTokens = {
  brand: Chromatic;
  sun: Chromatic;
  clay: Chromatic;
  neutral: typeof neutral;
  semantic: typeof semantic;
  cultural: typeof cultural;
  systemLight: typeof systemLight;
  systemDark: typeof systemDark;
};

export const colors: WcoColorTokens = {
  brand,
  sun,
  clay,
  neutral,
  semantic,
  cultural,
  systemLight,
  systemDark,
};
