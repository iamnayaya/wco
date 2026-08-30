import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * Timeline — a vertical chronological list with nodes, connector lines, and
 * optional custom markers/icons per entry. Used for chat history, order
 * events, and activity logs.
 */
export interface TimelineItem {
  id: string | number;
  title: ReactNode;
  /** Secondary text (timestamp, description). */
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  content?: ReactNode;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

const TONE_DOT: Record<NonNullable<TimelineItem['tone']>, string> = {
  info: '#3b82f6',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  neutral: '#94a3b8',
};

export function Timeline({ items, className, style, ariaLabel = 'Timeline' }: TimelineProps) {
  return (
    <ol aria-label={ariaLabel} className={cn('wco-timeline', className)} style={{ listStyle: 'none', margin: 0, padding: 0, ...style }}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const color = TONE_DOT[item.tone ?? 'info'];
        return (
          <li key={item.id} style={{ position: 'relative', display: 'flex', gap: 14, paddingBottom: !last ? 24 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: sem('surface'), border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 11, color }}>
                {item.icon}
              </div>
              {!last && (
                <div aria-hidden style={{ width: 2, flex: 1, minHeight: 16, background: sem('border'), marginTop: 4 }} />
              )}
            </div>
            <div style={{ paddingBottom: !last ? 0 : 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: sem('text') }}>{item.title}</div>
              {item.detail && <div style={{ fontSize: 12, color: sem('textFaint'), marginTop: 2 }}>{item.detail}</div>}
              {item.content && <div style={{ marginTop: 6 }}>{item.content}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default Timeline;
