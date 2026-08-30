import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem, type Tone } from '../lib/styles';

export interface BadgeProps {
  tone?: Tone;
  /** Outline style (transparent fill, tinted text + border). */
  outline?: boolean;
  /** Dot indicator instead of text content. */
  dot?: boolean;
  /** Count badge variant (pills up to `max`, overflow "+"). */
  count?: number;
  max?: number;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const TONE_TEXT: Record<Tone, string> = {
  success: sem('successText'),
  warning: sem('warningText'),
  danger: sem('dangerText'),
  info: sem('infoText'),
  neutral: sem('text'),
};

const TONE_BG: Record<Tone, string> = {
  success: sem('successBg'),
  warning: sem('warningBg'),
  danger: sem('dangerBg'),
  info: sem('infoBg'),
  neutral: sem('bgSunken'),
};

const SIZES = { sm: { height: 20, fontSize: 11, px: 7 }, md: { height: 24, fontSize: 12, px: 9 }, lg: { height: 28, fontSize: 13, px: 11 } } as const;

/** Badge/pill with tone variants. Count mode renders `max+` overflow. */
export function Badge({
  tone = 'neutral',
  outline = false,
  dot = false,
  count,
  max = 99,
  icon,
  size = 'md',
  children,
  className,
  style,
}: BadgeProps) {
  const s = SIZES[size];
  const shown = count !== undefined ? (count > max ? `${max}+` : String(count)) : '';
  const pill: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: s.height,
    paddingInline: dot ? 0 : s.px,
    borderRadius: 9999,
    fontSize: s.fontSize,
    fontWeight: 600,
    fontFamily: 'var(--font-inter, system-ui)',
    color: outline ? TONE_TEXT[tone] : (tone === 'neutral' ? sem('text') : sem('textInverse')),
    background: outline ? 'transparent' : TONE_BG[tone],
    border: outline ? `1px solid ${TONE_TEXT[tone]}` : 'none',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    ...style,
  };
  return (
    <span role="status" aria-label={count !== undefined ? `Count: ${shown}` : typeof children === 'string' ? children : undefined} className={cn('wco-badge', className)} style={pill}>
      {dot && <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: TONE_TEXT[tone] }} />}
      {icon && <span aria-hidden style={{ display: 'inline-flex' }}>{icon}</span>}
      {children ?? shown}
    </span>
  );
}