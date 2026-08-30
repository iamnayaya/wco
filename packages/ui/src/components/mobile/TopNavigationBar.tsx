import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { shadows } from '../../design-tokens/layout';
import { Icon } from '../Icon';

export interface TopNavigationBarProps {
  title: string;
  subtitle?: string;
  /** Custom leading element (menu button, brand markâ€¦). */
  leading?: ReactNode;
  /** Renders a default back chevron when no `leading` given. */
  onLeading?: () => void;
  /** Accessible label for the back button. */
  leadingLabel?: string;
  /** Trailing actions (icons/buttons), ordered right-to-end. */
  actions?: ReactNode[];
  sticky?: boolean;
  elevated?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * TopNavigationBar â€” the mobile app bar: leading slot (default back),
 * stacked title + subtitle, and trailing icon actions. `sticky` surfaces it
 * on scroll; `elevated` adds the Material-style shadow.
 */
export function TopNavigationBar({
  title,
  subtitle,
  leading,
  onLeading,
  leadingLabel = 'Back',
  actions,
  sticky = true,
  elevated = false,
  className,
  style,
}: TopNavigationBarProps) {
  return (
    <header
      className={cn('wco-top-nav', className)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        minHeight: 56,
        background: sem('bg'),
        borderBottom: elevated ? 'none' : `1px solid ${sem('border')}`,
        boxShadow: elevated ? shadows.raised : undefined,
        ...(sticky ? { position: 'sticky', top: 0, zIndex: 900 } : undefined),
        ...style,
      }}
    >
      {onLeading ? (
        <button
          type="button"
          aria-label={leadingLabel}
          onClick={onLeading}
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            border: 'none',
            background: 'transparent',
            color: sem('text'),
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="chevronLeft" aria-hidden />
        </button>
      ) : (
        leading
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: 16, fontFamily: 'var(--font-inter, system-ui)', color: sem('text'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </span>
        {subtitle && (
          <span style={{ display: 'block', fontSize: 12, color: sem('textMuted'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </span>
        )}
      </span>
      {actions && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {actions.map((el, i) => (
            <span key={i} style={{ display: 'inline-flex' }}>{el}</span>
          ))}
        </span>
      )}
    </header>
  );
}