import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Card } from './Card';
import { sem } from '../lib/styles';

export interface StatCardProps {
  label: string;
  value: string | number;
  /** Percent change vs a period (shown as delta chip). */
  delta?: number | null;
  /** Optional symbol/format prefix or label for the delta. */
  deltaLabel?: string;
  /** Icon slot (top-right, subtle). */
  icon?: ReactNode;
  /** Extra content below (sparkline, footnote). */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** KPI stat card with trend delta and optional sparkline slot. */
export function StatCard({ label, value, delta, deltaLabel = 'vs prior', icon, children, className, style }: StatCardProps) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className={cn('wco-statcard', className)} style={{ minWidth: 0, ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: sem('textMuted') }}>
            {label}
          </p>
          <p style={{ marginTop: 6, fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: sem('text'), fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </p>
        </div>
        {icon && <span aria-hidden style={{ display: 'inline-flex', color: sem('primary'), opacity: 0.85 }}>{icon}</span>}
      </div>
      {delta !== undefined && delta !== null && (
        <p
          role="status"
          aria-label={`${delta >= 0 ? 'Up' : 'Down'} ${Math.abs(delta).toFixed(1)} percent versus prior period`}
          style={{
            marginTop: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 700,
            color: up ? sem('successText') : sem('dangerText'),
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span aria-hidden>{up ? '▲' : '▼'}</span>
          {Math.abs(delta).toFixed(1)}%
          <span style={{ fontWeight: 500, color: sem('textFaint') }}>{deltaLabel}</span>
        </p>
      )}
      {children}
    </Card>
  );
}