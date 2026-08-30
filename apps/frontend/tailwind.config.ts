import type { Config } from 'tailwindcss';

/**
 * WCO Design System — Tailwind config
 * Brand: warm, trustworthy, African-inspired ("Sunrise on the Savanna").
 *
 * This config is the runtime bridge to the canonical design tokens in
 * `packages/ui/src/design-tokens`. It maps:
 *   - colors  → chromatic ramps (brand/sun/clay, neutral, semantic, cultural)
 *   - fontFamily/width/letterSpacing/lineHeight → the fluid type system
 *   - spacing/radii/boxShadow → the layout system
 *   - keyframes/durations → the motion system
 *
 * Semantic theme switching (light/dark) is handled through CSS custom
 * properties (`--wco-*`) defined in `src/styles/globals.css`; Tailwind here
 * exposes the raw ramps + the semantic aliases as utilities.
 */

import { brand, sun, clay, neutral, semantic, cultural } from '../../packages/ui/src/design-tokens/color';
import { sizes, lineHeights, letterSpacing, fonts } from '../../packages/ui/src/design-tokens/typography';
import { spacing, radii, shadows, duration, easing } from '../../packages/ui/src/design-tokens/layout';
import { easings, keyframes as wcoKeyframes, durations as animDurations } from '../../packages/ui/src/design-tokens/animation';
import { breakpoints, containers, whitespace } from '../../packages/ui/src/design-tokens/layout-system';
import { gradients, blur } from '../../packages/ui/src/design-tokens/effects';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand,
        sun,
        clay,
        neutral,
        semantic: {
          success: semantic.success.DEFAULT,
          'success-deep': semantic.success.deep,
          'success-light': semantic.success.light,
          info: semantic.info.DEFAULT,
          'info-deep': semantic.info.deep,
          'info-light': semantic.info.light,
          warning: semantic.warning.DEFAULT,
          'warning-deep': semantic.warning.deep,
          'warning-light': semantic.warning.light,
          danger: semantic.danger.DEFAULT,
          'danger-deep': semantic.danger.deep,
          'danger-light': semantic.danger.light,
        },
        cultural,
      },
      // Fluid type scale (maps 1:1 to designTokens.type.sizes)
      fontSize: Object.fromEntries(
        Object.entries(sizes).map(([name, v]) => [name, v.size]),
      ),
      lineHeight: lineHeights,
      letterSpacing,
      fontFamily: {
        sans: fonts.sans as unknown as string[],
        mono: fonts.mono as unknown as string[],
      },
      spacing,
      borderRadius: radii,
      boxShadow: shadows,
      transitionTimingFunction: { ...easing, ...easings },
      transitionDuration: duration,
      minHeight: { touch: '44px' },
      screens: {
        base: '0px',
        sm: `${breakpoints.sm}px`,
        md: `${breakpoints.md}px`,
        lg: `${breakpoints.lg}px`,
        xl: `${breakpoints.xl}px`,
        '2xl': `${breakpoints['2xl']}px`,
      },
      maxWidth: {
        narrow: `${containers.narrow}px`,
        prose: `${containers.prose}px`,
        app: `${containers.app}px`,
        wide: `${containers.wide}px`,
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          lg: '2rem',
        },
      },
      backgroundImage: {
        'brand-wash': gradients.brandWash,
        'primary-sheen': gradients.primarySheen,
        'sun-sheen': gradients.sunSheen,
        'title-gradient': gradients.title,
        'insight': gradients.insight,
      },
      backdropBlur: {
        xs: `${blur.xs}px`,
        sm: `${blur.sm}px`,
        md: `${blur.md}px`,
        lg: `${blur.lg}px`,
        xl: `${blur.xl}px`,
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-scale': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-out': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'wco-fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'wco-fade-in-scale': { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'wco-slide-up': { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'wco-slide-down': { '0%': { opacity: '0', transform: 'translateY(-12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'wco-slide-in-right': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        'wco-slide-in-bottom': { '0%': { opacity: '0', transform: 'translateY(28px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'wco-pop': { '0%': { opacity: '0', transform: 'scale(0.5)' }, '60%': { opacity: '1', transform: 'scale(1.12)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'wco-pulse': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        'wco-shimmer': { '100%': { transform: 'translateX(100%)' } },
        'wco-skeleton': { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        'wco-spin': { to: { transform: 'rotate(360deg)' } },
        'wco-celebrate': { '0%': { opacity: '0', transform: 'scale(0.6)' }, '30%': { opacity: '1', transform: 'scale(1.15)' }, '55%': { transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'wco-ripple': { '0%': { transform: 'scale(0)', opacity: '0.5' }, '100%': { transform: 'scale(1)', opacity: '0' } },
        'wco-icon-pulse': { '0%, 100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.2)' } },
        'wco-icon-ring': { '0%, 100%': { transform: 'rotate(0)' }, '20%': { transform: 'rotate(12deg)' }, '40%': { transform: 'rotate(-12deg)' }, '60%': { transform: 'rotate(6deg)' }, '80%': { transform: 'rotate(-6deg)' } },
      },
      animation: {
        'fade-in': `fade-in ${duration.fast} ${easing.emphasized}`,
        'fade-in-scale': `fade-in-scale ${duration.moderate} ${easing.emphasized}`,
        'slide-in': `slide-in ${duration.moderate} ${easing.standard}`,
        'slide-out': `slide-out ${duration.fast} ${easing.exit}`,
        'scale-in': `scale-in ${duration.fast} ${easing.emphasized}`,
        'pop': `${wcoKeyframes.pop.name} ${animDurations.moderate} ${easings.spring}`,
        'pulse': `${wcoKeyframes.pulse.name} ${animDurations.slower} ${easings.standard} infinite`,
        'shimmer': `${wcoKeyframes.shimmer.name} ${animDurations.slower} ${easings.linear} infinite`,
        'skeleton': `${wcoKeyframes.skeleton.name} ${animDurations.slower} ${easings.linear} infinite`,
        'spin': `${wcoKeyframes.spin.name} 800ms ${easings.linear} infinite`,
        'celebrate': `${wcoKeyframes.celebrate.name} ${animDurations.slower} ${easings.spring}`,
        'slide-in-bottom': `${wcoKeyframes['slideInBottom'].name} ${animDurations.slow} ${easings.emphasized}`,
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

/**
 * Spacing: the `whitespace` macro-scale is exposed as named utilities via the
 * token map above (`space` in layout.ts covers the 4–256 micro scale). This
 * object is documented for teams that prefer semantic section rhythm by name.
 */
export const sectionRhythm = whitespace;

export default config;
