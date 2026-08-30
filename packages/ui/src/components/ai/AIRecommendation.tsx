import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { shadows, radii } from '../../design-tokens/layout';
import { type Tone } from '../../lib/styles';
import { Icon } from '../Icon';

export interface AIRecommendationProps {
  title: string;
  description?: string;
  /** Bullet reasons shown with a check accent. */
  reasons?: readonly string[];
  icon?: ReactNode;
  tone?: Tone;
  /** Primary call-to-action (renders a real button). */
  actionLabel?: string;
  onAction?: () => void;
  /** Dismiss button (render glyph, owned by consumer callback). */
  dismissLabel?: string;
  onDismiss?: () => void;
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
 * AIRecommendation â€” a persuasive suggestion card (respond faster, resend,
 * adjust pricingâ€¦). Reasons render as a list (`role="list"`, li items) so
 * screen readers enumerate them; the primary CTA is a real `<button>`.
 */
export function AIRecommendation({
  title,
  description,
  reasons,
  icon,
  tone = 'info',
  actionLabel,
  onAction,
  dismissLabel,
  onDismiss,
  className,
  style,
}: AIRecommendationProps) {
  const accent = ACCENT[tone];

  return (
    <div
      className={cn('wco-ai-recommendation', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        background: `${accent}0f`,
        border: `1px solid ${accent}33`,
        borderLeft: `4px solid ${accent}`,
        borderRadius: radii.lg,
        boxShadow: shadows.card,
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && (
          <span aria-hidden style={{ color: accent, display: 'inline-flex' }}>
            {icon}
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-inter, system-ui)', color: sem('text') }}>
          {title}
        </span>
        <span
          aria-hidden
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.08em',
            padding: '2px 6px',
            borderRadius: 5,
            background: `${accent}1f`,
            color: accent,
          }}
        >
          AI
        </span>
        {dismissLabel && (
          <button
            type="button"
            aria-label={dismissLabel}
            onClick={onDismiss}
            style={{
              border: 'none',
              background: 'transparent',
              color: sem('textFaint'),
              cursor: 'pointer',
              padding: 4,
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: radii.sm,
            }}
          >
            <Icon name="close" aria-hidden />
          </button>
        )}
      </div>

      {description && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: sem('textMuted') }}>{description}</p>}

      {reasons && reasons.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {reasons.map((reason, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: sem('text') }}>
              <Icon name="check" size="sm" aria-hidden style={{ color: accent, marginTop: 2 }} />
              <span style={{ lineHeight: 1.45 }}>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {actionLabel && (
        <div style={{ marginTop: 2 }}>
          <button
            type="button"
            onClick={onAction}
            style={{
              border: 'none',
              background: accent,
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              fontFamily: 'var(--font-inter, system-ui)',
              padding: '9px 18px',
              borderRadius: radii.md,
              cursor: 'pointer',
            }}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}