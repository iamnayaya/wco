import { createContext, useCallback, useContext, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { shadows } from '../../design-tokens/layout';
import { useId } from '../../lib/hooks';

/** Toast severity. */
export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastData {
  id: string;
  message: ReactNode;
  tone: ToastTone;
  title?: ReactNode;
  duration: number;
}

export interface ToastOptions {
  tone?: ToastTone;
  title?: ReactNode;
  duration?: number;
  /** Render a dismiss action. */
  dismissible?: boolean;
}

export interface ToastApi {
  toast: (message: ReactNode, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Access the toast API inside a component. Must be within `<ToastProvider>`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const TONE_COLOR: Record<ToastTone, string> = {
  info: '#3b82f6',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
};

/** Provider that renders a fixed toast viewport and exposes the `useToast` API. */
export function ToastProvider({
  children,
  viewportProps,
  limit = 5,
  className,
}: {
  children: ReactNode;
  viewportProps?: CSSProperties;
  limit?: number;
  className?: string;
}) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const idCounter = useRef(0);
  const uid = useId('toast');

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => setToasts([]), []);

  const toast = useCallback(
    (message: ReactNode, options: ToastOptions = {}) => {
      const id = `${uid}-${++idCounter.current}`;
      const entry: ToastData = {
        id,
        message,
        tone: options.tone ?? 'info',
        title: options.title,
        duration: options.duration ?? 4000,
      };
      setToasts((prev) => [...prev.slice(-(limit - 1)), entry]);

      if (options.duration !== 0) {
        setTimeout(() => dismiss(id), entry.duration);
      }
      return id;
    },
    [uid, dismiss, limit],
  );

  const api = useMemo<ToastApi>(() => ({ toast, dismiss, dismissAll }), [toast, dismiss, dismissAll]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-live="polite"
        aria-label="Notifications"
        className={cn('wco-toast-viewport', className)}
        style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 1200,
          width: 'min(420px, calc(100vw - 32px))',
          ...viewportProps,
        }}
      >
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Single toast row (also exported for standalone use). */
export function Toast({ toast: t, onClose }: { toast: ToastData; onClose: () => void }) {
  const color = TONE_COLOR[t.tone];
  return (
    <div
      role={t.tone === 'danger' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        background: sem('surface'),
        borderRadius: 12,
        boxShadow: shadows.popover,
        border: '1px solid ' + sem('border'),
        borderLeft: `4px solid ${color}`,
      }}
    >
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {t.title && <div style={{ fontWeight: 600, fontSize: 14, color: sem('text') }}>{t.title}</div>}
        <div style={{ fontSize: 13, color: sem('textMuted') }}>{t.message}</div>
      </div>
      <button type="button" aria-label="Dismiss notification" onClick={onClose} style={{ border: 'none', background: 'transparent', color: sem('textFaint'), cursor: 'pointer', padding: 2, flexShrink: 0 }}>
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  );
}

export default ToastProvider;
