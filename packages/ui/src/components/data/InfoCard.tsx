import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { shadows, radii } from '../../design-tokens/layout';
import { type Tone } from '../../lib/styles';

export interface InfoCardProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  tone?: Tone;
  /** Header/trailing action slot (menu, link, button). */
  action?: ReactNode;
  /** Renders the whole card clickable (button semantics). */
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const ACCENT: Record<Tone, string> = {
  info: sem('infoText'),
  success: sem('successText'),
  warning: sem('warningText'),
  danger: sem('dangerText'),
  neutral: sem('textMuted'),
};

/**
 * InfoCard â€” a compact reference card (contact, order summary, risk notice).
 * Optional left accent bar, icon tile, trailing actions, and an optional
 * whole-card click surface that stays a real button.
 */
export function InfoCard({
  icon,
  title,
  description,
  tone = 'neutral',
  action,
  onClick,
  children,
  className,
  style,
}: InfoCardProps) {
  const accent = ACCENT[tone];
  const body = (
    <>
      {icon && (
        <span
          aria-hidden
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: radii.md,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${accent}1a`,
            color: accent,
          }}
        >
          {icon}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-inter, system-ui)', color: sem('text') }}>
          {title}
        </span>
        {description && <span style={{ display: 'block', fontSize: 13, lineHeight: 1.45, color: sem('textMuted') }}>{description}</span>}
      </span>
    </>
  );

  const content = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      {body}
      {action && <span style={{ flexShrink: 0 }}>{action}</span>}
    </div>
  );

  const card: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '14px 16px',
    background: sem('surface'),
    border: `1px solid ${sem('border')}`,
    borderLeft: `3px solid ${accent}`,
    borderRadius: radii.md,
    boxShadow: shadows.card,
    width: '100%',
    boxSizing: 'border-box',
    textAlign: 'start',
    transition: `border-color ${motion.fast}, box-shadow ${motion.fast}, transform ${motion.fast}`,
    ...style,
  };

  return (
    <div className={cn('wco-info-card', className)} style={card}>
      {onClick ? (
        <button type="button" onClick={onClick} style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'start', cursor: 'pointer', width: '100%' }}>
          {content}
        </button>
      ) : (
        content
      )}
      {children}
    </div>
  );
}