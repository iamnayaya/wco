import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { shadows } from '../../design-tokens/layout';
import { usePopoverPosition, useId, type Placement } from '../../lib/hooks';

/**
 * Tooltip — a minimal hover/focus label anchored to its trigger. Uses
 * `usePopoverPosition` for positioning and arrow-key-safe focus visibility
 * (reveals on both hover and keyboard focus for WCAG compliance).
 */
export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  placement?: Placement;
  /** Delay before showing (ms). */
  delay?: number;
  className?: string;
  style?: CSSProperties;
}

export function Tooltip({ label, children, placement = 'top', delay = 250, className, style }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = useId('tt');
  const pos = usePopoverPosition(triggerRef, popRef, placement, open);

  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const exit = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span className={cn('wco-tooltip', className)} style={{ display: 'inline-flex', position: 'relative', ...style }}>
      <span
        ref={triggerRef}
        tabIndex={0}
        onMouseEnter={enter}
        onMouseLeave={exit}
        onFocus={enter}
        onBlur={exit}
        aria-describedby={open ? uid : undefined}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>
      {open && (
        <div
          ref={popRef}
          id={uid}
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 900,
            background: sem('text'),
            color: sem('surface'),
            fontSize: 12,
            fontWeight: 500,
            padding: '6px 10px',
            borderRadius: 8,
            boxShadow: shadows.raised,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            maxWidth: 260,
          }}
        >
          {label}
        </div>
      )}
    </span>
  );
}

export default Tooltip;
