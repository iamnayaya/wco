import { useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { shadows } from '../../design-tokens/layout';
import { useControllableState, usePopoverPosition, useClickOutside, useKey, useId, type Placement } from '../../lib/hooks';

/**
 * Popover — a floating panel anchored to its trigger, opening on click with
 * outside-click and Escape to close, plus proper button/aria wiring.
 * Use as a styled, accessible alternative to native menus/selects.
 */
export interface PopoverProps {
  trigger: (props: { ref: React.RefObject<HTMLButtonElement | null>; 'aria-expanded': boolean; 'aria-haspopup': boolean; onClick: () => void }) => ReactNode;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  /** When true, clicking the trigger toggles (default). */
  toggle?: boolean;
  width?: number;
  className?: string;
  style?: CSSProperties;
  role?: 'menu' | 'dialog' | 'listbox';
}

export function Popover({
  trigger,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-start',
  toggle = true,
  width = 240,
  className,
  style,
  role = 'menu',
}: PopoverProps) {
  const [isOpen, setIsOpen] = useControllableState<boolean>({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const uid = useId('pop');
  const pos = usePopoverPosition(triggerRef, popRef, placement, isOpen);

  useClickOutside(popRef, () => isOpen && setIsOpen(false), isOpen);
  useKey('Escape', () => isOpen && setIsOpen(false));

  return (
    <div className={cn('wco-popover', className)} style={{ position: 'relative', display: 'inline-flex', ...style }}>
      {trigger({
        ref: triggerRef,
        'aria-expanded': isOpen,
        'aria-haspopup': true,
        onClick: () => setIsOpen(toggle ? !isOpen : true),
      })}
      {isOpen && (
        <div
          ref={popRef}
          id={uid}
          role={role}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 950,
            background: sem('surface'),
            borderRadius: 12,
            boxShadow: shadows.popover,
            border: `1px solid ${sem('border')}`,
            padding: 6,
            minWidth: width,
            outline: 'none',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default Popover;
