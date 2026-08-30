import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { shadows, radii } from '../../design-tokens/layout';
import { type Tone } from '../../lib/styles';

export interface AIPredictionProps {
  title: string;
  /** The predicted outcome text (e.g. "72% likelihood"). */
  outcome: string;
  /** Confidence 0â€“100. */
  confidence: number;
  trend?: 'up' | 'down' | 'flat';
  context?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  /** Show the "AI" attribution chip. */
  showBadge?: boolean;
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
 * AIPrediction â€” a data-driven outcome card (sales forecast, response-rate
 * estimateâ€¦). Exposes confidence as a true `role="progressbar"` and keeps
 * decorative visuals aria-hidden.
 */
export function AIPrediction({
  title,
  outcome,
  confidence,
  trend,
  context,
  actions,
  icon,
  tone = 'neutral',
  showBadge = true,
  className,
  style,
}: AIPredictionProps) {
  const pct = Math.min(100, Math.max(0, confidence));
  const accent = ACCENT[tone];

  return (
    <div
      className={cn('wco-ai-prediction', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        background: sem('surface'),
        border: `1px solid ${sem('border')}`,
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
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-inter, system-ui)', color: sem('text') }}>
          {title}
        </span>
        {showBadge && (
          <span
            aria-hidden
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.08em',
              padding: '2px 6px',
              borderRadius: 5,
              background: `${accent}1a`,
              color: accent,
            }}
          >
            AI
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: accent, fontFamily: 'var(--font-inter, system-ui)', letterSpacing: '-0.02em' }}>
          {outcome}
        </span>
        {trend && trend !== 'flat' && (
          <span aria-hidden style={{ fontSize: 12, fontWeight: 600, color: trend === 'up' ? sem('successText') : sem('dangerText') }}>
            {trend === 'up' ? 'â–²' : 'â–¼'}
          </span>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: sem('textMuted') }}>Confidence</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: sem('text') }}>{pct}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={`${title} confidence`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          style={{ height: 6, borderRadius: 999, background: sem('bgSunken'), overflow: 'hidden' }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: accent,
              borderRadius: 999,
              transition: `width ${motion.base}`,
            }}
          />
        </div>
      </div>

      {context && <div style={{ fontSize: 13, lineHeight: 1.5, color: sem('textMuted') }}>{context}</div>}
      {actions && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{actions}</div>}
    </div>
  );
}