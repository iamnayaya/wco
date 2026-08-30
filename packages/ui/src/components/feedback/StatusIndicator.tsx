import { type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { sem, motion } from '../../lib/styles';
import { useWcoI18n } from '../../lib/i18n';

export type StatusKind = 'online' | 'offline' | 'busy' | 'away' | 'custom';

export interface StatusIndicatorProps {
  /** When `custom` (or omitted), pass an explicit `color`. */
  status?: StatusKind;
  color?: string;
  /** Accessible name of the state (ignored when `label` present). */
  label?: string;
  /** Show an inline text label next to the dot. */
  withLabel?: boolean;
  /** Pulsing dot (attention/loading states). */
  pulse?: boolean;
  /** Dot diameter in px. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const PALETTE: Record<Exclude<StatusKind, 'custom'>, string> = {
  online: 'var(--wco-successText, var(--fallback-successText, #059669))',
  offline: 'var(--wco-textFaint, var(--fallback-textFaint, #94a3b8))',
  busy: 'var(--wco-dangerText, var(--fallback-dangerText, #dc2626))',
  away: 'var(--wco-warningText, var(--fallback-warningText, #d97706))',
};

/**
 * StatusIndicator — a small state dot with a hidden (or visible) label.
 * The dot alone is `aria-hidden`; the accessible name always comes from
 * the text layer so screen readers never hear a color.
 */
export function StatusIndicator({
  status = 'custom',
  color,
  label,
  withLabel = false,
  pulse = false,
  size = 10,
  className,
  style,
}: StatusIndicatorProps) {
  const { t } = useWcoI18n();
  const fallbackLabel =
    label ??
    (status === 'custom' ? undefined : t[status]);

  return (
    <span
      className={cn('wco-status-indicator', className)}
      role={fallbackLabel ? 'status' : undefined}
      aria-label={fallbackLabel}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}
    >
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color ?? PALETTE[status as Exclude<StatusKind, 'custom'>] ?? sem('textFaint'),
          flexShrink: 0,
          ...(pulse
            ? {
                animation: `wco-pulse 1400ms ${motion.base} infinite`,
              }
            : null),
        }}
      />
      {fallbackLabel && (
        <span
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
            padding: 0,
            margin: -1,
          }}
        >
          {fallbackLabel}
        </span>
      )}
      {withLabel && fallbackLabel && (
        <span style={{ fontSize: 13, color: sem('textMuted') }}>{fallbackLabel}</span>
      )}
    </span>
  );
}