/**
 * WCO design tokens — single source of truth for color + spacing.
 * Tailwind config and the mobile kit both mirror these values.
 */
export const tokens = {
  color: {
    brand: '#059669',
    brandDark: '#047857',
    surface: '#f8fafc',
    ink: '#0f172a',
    muted: '#64748b',
    danger: '#dc2626',
    warning: '#d97706',
  },
  radius: { sm: '6px', md: '10px', lg: '12px' },
} as const;

export type WcoTokens = typeof tokens;
