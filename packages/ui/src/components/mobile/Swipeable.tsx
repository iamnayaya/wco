import { useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Swipeable — a swipe gesture wrapper exposing left/right (and optional
 * up/down) swipe callbacks with configurable thresholds. Pointer-Event based,
 * dependency-free.
 */
export interface SwipeableProps {
  children: ReactNode;
  onSwipedLeft?: () => void;
  onSwipedRight?: () => void;
  onSwipedUp?: () => void;
  onSwipedDown?: () => void;
  /** Minimum px distance for a swipe to register. */
  threshold?: number;
  /** Allowed axes: 'x' | 'y' | 'both'. */
  axes?: 'x' | 'y' | 'both';
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

interface Origin {
  x: number;
  y: number;
}

export function Swipeable({ children, onSwipedLeft, onSwipedRight, onSwipedUp, onSwipedDown, threshold = 40, axes = 'both', disabled = false, className, style }: SwipeableProps) {
  const origin = useRef<Origin | null>(null);

  const handleDown = (e: React.PointerEvent) => {
    if (disabled) return;
    origin.current = { x: e.clientX, y: e.clientY };
  };

  const handleUp = (e: React.PointerEvent) => {
    if (!origin.current || disabled) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    origin.current = null;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const xAllowed = axes !== 'y';
    const yAllowed = axes !== 'x';

    if (xAllowed && adx >= threshold && adx > ady) {
      if (dx < 0) onSwipedLeft?.();
      else onSwipedRight?.();
    } else if (yAllowed && ady >= threshold && ady > adx) {
      if (dy < 0) onSwipedUp?.();
      else onSwipedDown?.();
    }
  };

  return (
    <div
      className={cn('wco-swipeable', className)}
      style={{ touchAction: axes === 'y' ? 'pan-y' : axes === 'x' ? 'pan-x' : 'none', ...style }}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={() => (origin.current = null)}
    >
      {children}
    </div>
  );
}

export default Swipeable;
