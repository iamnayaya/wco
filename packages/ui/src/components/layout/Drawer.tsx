import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { shadows } from '../../design-tokens/layout';
import { useFocusTrap, useScrollLock, useKey, useId } from '../../lib/hooks';

/**
 * Drawer — a side panel (right by default) sliding over content, with focus
 * trap, scroll lock, Escape-to-close, and ARIA dialog semantics.
 */
export type DrawerSide = 'left' | 'right' | 'top' | 'bottom';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: DrawerSide;
  /** Size: width in px for left/right; height for top/bottom. */
  size?: number;
  footer?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Drawer({ open, onClose, title, children, side = 'right', size = 380, footer, className, style }: DrawerProps) {
  const { focusContainerRef: ref, focusFirst } = useFocusTrap(open);
  const uid = useId('drawer');
  const titleId = `${uid}-title`;

  useScrollLock(open);
  useKey('Escape', onClose);

  useEffect(() => {
    if (open) requestAnimationFrame(() => focusFirst());
  }, [open, focusFirst]);

  if (!open) return null;

  const horizontal = side === 'left' || side === 'right';

  return (
    <div className={cn('wco-drawer', className)} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      <div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0, background: sem('overlay') }} />
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        role="document"
        style={{
          position: 'absolute',
          background: sem('surface'),
          boxShadow: shadows.raised,
          display: 'flex',
          flexDirection: 'column',
          [horizontal ? 'width' : 'height']: size,
          ...(side === 'right' && { insetBlock: 0, right: 0 }),
          ...(side === 'left' && { insetBlock: 0, left: 0 }),
          ...(side === 'top' && { insetInline: 0, top: 0 }),
          ...(side === 'bottom' && { insetInline: 0, bottom: 0 }),
          ...style,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${sem('border')}` }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: sem('text') }}>
            {title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: sem('textFaint'), padding: 4, display: 'inline-flex', borderRadius: 8 }}>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>{children}</div>
        {footer && <div style={{ padding: 16, borderTop: `1px solid ${sem('border')}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

export default Drawer;
