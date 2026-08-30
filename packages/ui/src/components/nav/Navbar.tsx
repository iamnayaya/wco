import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { shadows, radii } from '../../design-tokens/layout';

export type NavbarVariant = 'static' | 'sticky' | 'fixed' | 'floating';

export interface NavbarProps {
  /** Brand slot â€” logo, wordmark, avatarâ€¦ */
  logo?: ReactNode;
  /** Center nav links (from `Menu`, `LinkList` or plain links). */
  nav?: ReactNode;
  /** Trailing actions (icons, buttons, menu). */
  actions?: ReactNode;
  /** Search slot (rendered between nav and actions when present). */
  search?: ReactNode;
  variant?: NavbarVariant;
  /** Transparent background variant for hero/landing layouts. */
  transparent?: boolean;
  /** Bar height in px. */
  height?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Navbar â€” the app's top rail in four motion modes: `static`, `sticky`,
 * `fixed` and floating (detached, rounded, with elevation). Always a
 * `banner`-role landmark with transparent + surface themes.
 */
export function Navbar({
  logo,
  nav,
  actions,
  search,
  variant = 'sticky',
  transparent = false,
  height = 64,
  className,
  style,
}: NavbarProps) {
  const positioned = variant === 'fixed' || variant === 'floating' ? ('fixed' as const) : variant === 'sticky' ? ('sticky' as const) : undefined;
  const floating = variant === 'floating';
  const css: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    height,
    paddingInline: floating ? 20 : 24,
    width: '100%',
    boxSizing: 'border-box',
    background: transparent ? 'transparent' : sem('bg'),
    borderBottom: transparent || floating ? 'none' : `1px solid ${sem('border')}`,
    boxShadow: floating ? shadows.raised : undefined,
    borderRadius: floating ? radii.lg : 0,
    ...(positioned ? { position: positioned, top: 0, zIndex: 940 } : undefined),
    ...(floating ? { maxWidth: 1200, margin: 0 } : undefined),
    ...style,
  };

  return (
    <header role="banner" className={cn('wco-navbar', className)} style={css}>
      {logo && <div style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>{logo}</div>}
      {nav && (
        <nav aria-label="Primary" style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {nav}
        </nav>
      )}
      <span style={{ flex: 1 }} />
      {search && <div style={{ width: 280, maxWidth: '22vw' }}>{search}</div>}
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>{actions}</div>
      )}
    </header>
  );
}