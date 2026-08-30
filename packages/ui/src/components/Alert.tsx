import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem, type Tone } from '../lib/styles';

export interface AlertProps {
  tone?: Exclude<Tone, 'neutral'>;
  /** Bold title. */
  title?: ReactNode;
  /** Body content (use short paragraphs). */
  children?: ReactNode;
  /** Dismissible — requires `onDismiss`. */
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const TONE_CSS: Record<Exclude<Tone, 'neutral'>, { role: 'alert' | 'status'; bg: string; fg: string; border: string }> = {
  danger: { role: 'alert', bg: sem('dangerBg'), fg: sem('dangerText'), border: sem('dangerBg') },
  warning: { role: 'alert', bg: sem('warningBg'), fg: sem('warningText'), border: sem('warningBg') },
  success: { role: 'status', bg: sem('successBg'), fg: sem('successText'), border: sem('successBg') },
  info: { role: 'status', bg: sem('infoBg'), fg: sem('infoText'), border: sem('infoBg') },
};

/**
 * Accessible alert banner. `danger`/`warning` use `role="alert"`; success/info
 * use `role="status"` so they don't interrupt SR users unless an error/safety
 * condition changes. Dismiss uses `aria-label`.
 */
export function Alert({ tone = 'info', title, children, dismissible = false, onDismiss, icon, actions, className, style }: AlertProps) {
  const t = TONE_CSS[tone];
  return (
    <div
      role={t.role}
      className={cn('wco-alert', className)}
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: '12px 14px',
        borderRadius: 12,
        background: t.bg,
        color: t.fg,
        fontSize: 14,
        ...style,
      }}
    >
      {icon && <span aria-hidden style={{ display: 'inline-flex', marginTop: 1 }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{title}</p>}
        {children && <div style={{ marginTop: title ? 2 : 0, opacity: 0.92 }}>{children}</div>}
        {actions && <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
      {dismissible && onDismiss && (
        <button
          type="button"
          aria-label="Dismiss alert"
          onClick={onDismiss}
          style={{
            appearance: 'none',
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1,
            padding: 4,
            opacity: 0.7,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}