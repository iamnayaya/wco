import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * AIInsight — a compact "intelligence" callout showing a metric with a trend
 * (up/down/flat), a short rationale, and optional actions. Built for commerce
 * analytics (e.g. "Revenue +12% from WhatsApp orders").
 */
export interface AIInsightProps {
  label?: string;
  /** Main headline value, e.g. "+12%". */
  value: ReactNode;
  /** Short explanation. */
  text: ReactNode;
  trend?: 'up' | 'down' | 'flat';
  /** Tone of the trend (for coloring). */
  trendTone?: 'success' | 'danger' | 'neutral';
  badge?: string;
  onAction?: () => void;
  actionLabel?: string;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function AIInsight({ label = 'Insight', value, text, trend, trendTone = 'success', badge, onAction, actionLabel = 'View', icon, className, style }: AIInsightProps) {
  const accent = trendTone === 'success' ? sem('successText') : trendTone === 'danger' ? sem('dangerText') : sem('textMuted');

  return (
    <div
      data-ai
      className={cn('wco-ai-insight', className)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        background: sem('bgSunken'),
        borderRadius: 14,
        ...style,
      }}
    >
      {icon && <div style={{ flexShrink: 0, color: accent }}>{icon}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: sem('textMuted') }}>{label}</span>
          {badge && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: sem('accent'), color: sem('accentFg') }}>{badge}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: sem('text'), lineHeight: 1 }}>{value}</span>
          {trend && (
            <span aria-label={`${trend === 'flat' ? 'flat' : trend} trend`} style={{ fontSize: 13, fontWeight: 600, color: accent }}>
              {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '•'}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: sem('textMuted'), lineHeight: 1.4 }}>{text}</div>
      </div>
      {onAction && (
        <button type="button" onClick={onAction} style={{ flexShrink: 0, border: 'none', background: 'transparent', color: sem('primary'), fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: 4 }}>
          {actionLabel} →
        </button>
      )}
    </div>
  );
}

export default AIInsight;
