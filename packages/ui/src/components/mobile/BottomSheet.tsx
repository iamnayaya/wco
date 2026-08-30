import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { shadows } from '../../design-tokens/layout';
import { useFocusTrap, useScrollLock, useKey, useId } from '../../lib/hooks';

/**
 * BottomSheet — a mobile-first modal that slides up from the bottom with a
 * drag handle, optional snap points, focus trap, and scroll lock. Falls back
 * gracefully on desktop (centered-ish width-limited sheet).
 */
export type SheetSnap = number;

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Snap heights as fractions (0–1) or px; default [0.4, 0.9]. */
  snaps?: Array<number>;
  /** Current snap index. When set, the sheet is controlled. */
  snapIndex?: number;
  onSnapChange?: (index: number) => void;
  maxWidth?: number;
  showHandle?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function BottomSheet({ open, onClose, title, children, snaps = [0.4, 0.9], snapIndex, onSnapChange, maxWidth = 640, showHandle = true, className, style }: BottomSheetProps) {
  const { focusContainerRef: ref, focusFirst } = useFocusTrap(open);
  const uid = useId('sheet');
  const titleId = `${uid}-title`;

  useScrollLock(open);
  useKey('Escape', onClose);

  useEffect(() => {
    if (open) requestAnimationFrame(() => focusFirst());
  }, [open, focusFirst]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') onSnapChange?.(Math.min(snaps.length - 1, (snapIndex ?? 1) + 1));
      if (e.key === 'ArrowDown') onSnapChange?.(Math.max(0, (snapIndex ?? 1) - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onSnapChange, snapIndex, snaps.length]);

  if (!open) return null;

  const snapFraction = snaps[snapIndex ?? snaps.length - 1] ?? 0.9;
  const height = snapFraction <= 1 ? `${snapFraction * 100}vh` : `${snapFraction}px`;

  return (
    <div className={cn('wco-bottom-sheet', className)} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div aria-hidden onClick={onClose} style={{ position: 'absolute', inset: 0, background: sem('overlay') }} />
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        role="document"
        style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          maxWidth,
          height,
          background: sem('surface'),
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          boxShadow: shadows.modal,
          display: 'flex',
          flexDirection: 'column',
          ...style,
        }}
      >
        {showHandle && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
            <span aria-hidden style={{ width: 40, height: 4, borderRadius: 999, background: sem('borderStrong') }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
          {title && <h2 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 700, color: sem('text') }}>{title}</h2>}
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'transparent', color: sem('textFaint'), cursor: 'pointer', padding: 4 }}>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 20px' }}>{children}</div>
      </div>
    </div>
  );
}

export default BottomSheet;
