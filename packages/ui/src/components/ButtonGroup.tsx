import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react';
import { cn } from '../lib/cn';
import { controlSize, controlBorderRadius, motion, sem, type ControlSize } from '../lib/styles';

export interface ButtonGroupProps extends Omit<ButtonHTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Orientation. Vertical stacks and joins the children edge-to-edge. */
  orientation?: 'horizontal' | 'vertical';
  /** Children should be `<Button>`/`<IconButton>` or any button-ish element. */
  children: React.ReactNode;
}

/**
 * Attaches a row/column of buttons so borders merge and share a radius.
 * Orientation-aware; uses `role="group"` with an accessible name via
 * `aria-label` (or the `title` of the group).
 */
export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(function ButtonGroup(
  { orientation = 'horizontal', className, style, children, ...props },
  ref,
) {
  const htmlDirection = orientation === 'vertical' ? 'column' : 'row';
  const groupCss: CSSProperties = {
    display: 'inline-flex',
    flexDirection: htmlDirection,
    alignItems: 'stretch',
    borderRadius: controlBorderRadius.md,
    overflow: 'hidden',
    ...style,
  };
  return (
    <div ref={ref} role="group" className={cn('wco-button-group', className)} style={{ display: 'inline-flex' }}>
      <div
        role="presentation"
        style={groupCss}
        {...props}
      >
        {children}
      </div>
    </div>
  );
});

/**
 * Shared utility for merging a child's border radius inside a group —
 * used by consumers to give first/last items rounded ends.
 */
export function groupRadius(index: number, total: number, orientation: 'horizontal' | 'vertical') {
  if (total <= 1) return controlBorderRadius.md;
  const first = index === 0;
  const last = index === total - 1;
  if (orientation === 'horizontal') {
    return `${first ? controlBorderRadius.md : '0'} ${last ? controlBorderRadius.md : '0'} ${last ? controlBorderRadius.md : '0'} ${first ? controlBorderRadius.md : '0'}`;
  }
  return `${first ? controlBorderRadius.md : '0'} ${first ? controlBorderRadius.md : '0'} ${last ? controlBorderRadius.md : '0'} ${last ? controlBorderRadius.md : '0'}`;
}

/** Simple themed divider button helper used inside groups (e.g. separator). */
export function GroupSeparator({ orientation = 'horizontal', size = 'md' }: { orientation?: 'horizontal' | 'vertical'; size?: ControlSize }) {
  const s = controlSize[size];
  const css: CSSProperties = {
    width: orientation === 'horizontal' ? 1 : s.height,
    height: orientation === 'horizontal' ? Math.round(s.height * 0.6) : 1,
    alignSelf: 'center',
    flexShrink: 0,
    background: sem('border'),
  };
  return <span aria-hidden className="wco-group-separator" style={css} />;
}