import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Action buttons rendered below. */
  children?: ReactNode;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Friendly empty/zero-state panel with optional actions. */
export function EmptyState({ icon, title, description, children, compact = false, className, style }: EmptyStateProps) {
  const pad = compact ? '32px 20px' : '56px 24px';
  return (
    <div
      className={cn('wco-empty-state', className)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: pad,
        borderRadius: 16,
        border: `1px dashed ${sem('borderStrong')}`,
        background: sem('bgRaised'),
        ...style,
      }}
    >
      {icon && (
        <div style={{ display: 'inline-flex', marginBottom: 14, color: sem('primary'), opacity: 0.9 }} aria-hidden>{icon}</div>
      )}
      <p style={{ margin: 0, fontSize: compact ? 14 : 16, fontWeight: 700, color: sem('text') }}>{title}</p>
      {description && (
        <p style={{ marginTop: 6, maxWidth: 380, fontSize: 14, lineHeight: 1.5, color: sem('textMuted') }}>{description}</p>
      )}
      {children && <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>{children}</div>}
    </div>
  );
}