import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { shadows } from '../../design-tokens/layout';
import { useFocusTrap, useScrollLock, useKey, useId } from '../../lib/hooks';

/**
 * Modal — accessible focus-trapped dialog with backdrop, Escape-to-close,
 * optional close button, and ARIA dialog semantics. Scroll-locks the body.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** The modal content. */
  children: ReactNode;
  /** Default content width (px). */
  width?: number;
  /** Hide the backdrop click + close button (e.g. for required confirmations). */
  dismissable?: boolean;
  /** Optional footer rendered under content. */
  footer?: ReactNode;
  showCloseButton?: boolean;
  className?: string;
  style?: CSSProperties;
  'aria-describedby'?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 480,
  dismissable = true,
  footer,
  showCloseButton = true,
  className,
  style,
  'aria-describedby': ariaDescribedBy,
}: ModalProps) {
  const { focusContainerRef: ref, focusFirst } = useFocusTrap(open);
  const uid = useId('modal');
  const titleId = `${uid}-title`;

  useScrollLock(open);
  useKey('Escape', () => dismissable && onClose());

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => focusFirst());
    }
  }, [open, focusFirst]);

  if (!open) return null;

  return (
    <div className={cn('wco-modal', className)} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-describedby={ariaDescribedBy} style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div
        aria-hidden
        onClick={() => dismissable && onClose()}
        style={{ position: 'absolute', inset: 0, background: sem('overlay') }}
      />
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        role="document"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          overflow: 'auto',
          background: sem('surface'),
          borderRadius: 16,
          boxShadow: shadows.modal,
          padding: 24,
          outline: 'none',
          ...style,
        }}
      >
        {(title || showCloseButton) && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            {title && (
              <h2 id={titleId} style={{ margin: 0, fontSize: 20, fontWeight: 700, color: sem('text') }}>
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: sem('textFaint'),
                  padding: 4,
                  display: 'inline-flex',
                  borderRadius: 8,
                }}
              >
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            )}
          </div>
        )}
        <div>{children}</div>
        {footer && <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

/** `Dialog` — alias of `Modal` for semantic naming in dialogs/confirmations. */
export const Dialog = Modal;

export default Modal;
