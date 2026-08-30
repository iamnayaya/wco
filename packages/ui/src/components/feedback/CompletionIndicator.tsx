import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { Icon } from '../Icon';

export type CompletionStatus = 'success' | 'failure' | 'partial';

export interface CompletionIndicatorProps {
  status: CompletionStatus;
  title: string;
  message?: ReactNode;
  /** Success/partial announce politely; failure uses `role="alert"`. */
  announcements?: boolean;
  /** Show the state icon inside a tinted circle. */
  showIcon?: boolean;
  className?: string;
  style?: CSSProperties;
}

const ICON: Record<CompletionStatus, 'check' | 'close' | 'warning'> = {
  success: 'check',
  failure: 'close',
  partial: 'warning',
};

const COLOR: Record<CompletionStatus, string> = {
  success: sem('successText'),
  failure: sem('dangerText'),
  partial: sem('warningText'),
};

/**
 * CompletionIndicator — an operation result summary. Success/partial are
 * polite live regions, failure is an alert; optional tinted icon circle.
 */
export function CompletionIndicator({
  status,
  title,
  message,
  announcements = true,
  showIcon = true,
  className,
  style,
}: CompletionIndicatorProps) {
  const role = status === 'failure' && announcements ? 'alert' : announcements ? 'status' : undefined;
  const color = COLOR[status];

  return (
    <div
      role={role}
      aria-label={role ? title : undefined}
      className={cn('wco-completion-indicator', className)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '16px',
        borderRadius: 12,
        background: sem('surface'),
        border: `1px solid ${sem('border')}`,
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {showIcon && (
        <span
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `${color}1f`,
            color,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={ICON[status]} />
        </span>
      )}
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-inter, system-ui)', color: sem('text') }}>
          {title}
        </span>
        {message && (
          <span style={{ display: 'block', marginTop: 4, fontSize: 13, lineHeight: 1.5, color: sem('textMuted') }}>{message}</span>
        )}
      </span>
    </div>
  );
}