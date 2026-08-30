import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { ProgressCircle } from '../feedback/ProgressCircle';

/**
 * PullToRefresh — wraps scrollable content and reveals a refresh indicator
 * when the user pulls down past a threshold; fires `onRefresh` and awaits its
 * completion. Touch-first with mouse support via Pointer Events.
 */
export interface PullToRefreshProps {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
  /** Pull distance (px) that triggers a refresh. */
  threshold?: number;
  /** Extra pull resistance (higher = harder). */
  resistance?: number;
  className?: string;
  style?: CSSProperties;
  indicatorLabel?: string;
  disabled?: boolean;
}

type Phase = 'idle' | 'pulling' | 'refreshing' | 'done';

export function PullToRefresh({ onRefresh, children, threshold = 64, resistance = 2.2, className, style, indicatorLabel = 'Pull to refresh', disabled = false }: PullToRefreshProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [dist, setDist] = useState(0);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);

  const begin = (clientY: number) => {
    if (disabled || phase === 'refreshing') return;
    if (window.scrollY > 0) return;
    startY.current = clientY;
    dragging.current = true;
  };

  const move = (clientY: number) => {
    if (!dragging.current || startY.current === null) return;
    const delta = clientY - startY.current;
    if (delta <= 0) {
      setDist(0);
      return;
    }
    setDist(Math.min(delta / resistance, threshold * 1.8));
    setPhase('pulling');
  };

  const end = async () => {
    if (!dragging.current) return;
    dragging.current = false;
    startY.current = null;
    if (dist >= threshold && phase !== 'refreshing') {
      setPhase('refreshing');
      setDist(threshold);
      await onRefresh();
      setPhase('done');
      setDist(0);
      setTimeout(() => setPhase('idle'), 400);
    } else {
      setDist(0);
      setPhase('idle');
    }
  };

  return (
    <div
      className={cn('wco-pull-refresh', className)}
      style={{ position: 'relative', overflow: 'hidden', touchAction: 'pan-y', ...style }}
      onPointerDown={(e) => begin(e.clientY)}
      onPointerMove={(e) => move(e.clientY)}
      onPointerUp={end}
      onPointerLeave={end}
    >
      {(phase === 'pulling' || phase === 'refreshing') && dist > 0 && (
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: Math.max(dist, 60),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: sem('textFaint'),
            fontSize: 13,
          }}
        >
          <ProgressCircle value={phase === 'refreshing' ? 100 : undefined} size={24} strokeWidth={3} />
          <span>{phase === 'refreshing' ? 'Refreshing…' : indicatorLabel}</span>
        </div>
      )}
      <div style={{ transform: `translateY(${phase === 'done' ? 0 : dist}px)`, transition: dragging.current ? 'none' : 'transform 200ms ease' }}>{children}</div>
    </div>
  );
}

export default PullToRefresh;
