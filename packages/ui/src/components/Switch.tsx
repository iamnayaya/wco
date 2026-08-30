import { forwardRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Accessible switch — `role="switch"` with `aria-checked`, keyboard toggling
 * (Space/Enter) and optional loading state.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, label, disabled = false, loading = false, id, className, style },
  ref,
) {
  const trackWidth = 44;
  const trackHeight = 26;
  const thumbSize = 20;
  const offset = 3;
  const travel = trackWidth - thumbSize - offset * 2;

  const on = sem('primary');
  const off = sem('borderStrong');

  const handleClick = () => {
    if (disabled || loading) return;
    onCheckedChange(!checked);
  };

  const button: CSSProperties = {
    position: 'relative',
    width: trackWidth,
    height: trackHeight,
    borderRadius: 9999,
    background: checked ? on : off,
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
    transition: 'background-color 160ms ease',
    ...style,
  };

  const thumb: CSSProperties = {
    position: 'absolute',
    top: offset,
    left: offset,
    width: thumbSize,
    height: thumbSize,
    borderRadius: '50%',
    background: '#fff',
    transform: checked ? `translateX(${travel}px)` : 'translateX(0)',
    transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: '0 1px 2px rgb(0 0 0 / 0.2)',
  };

  return (
    <div
      className={cn('wco-switch', className)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}
    >
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled || loading || undefined}
        aria-busy={loading || undefined}
        aria-label={typeof label === 'string' ? label : undefined}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            handleClick();
          }
        }}
        style={button}
      >
        <span aria-hidden style={thumb}>
          {loading && (
            <span
              style={{
                display: 'block',
                margin: 'auto',
                width: 12,
                height: 12,
                border: '2px solid rgba(0,0,0,.35)',
                borderTopColor: 'rgba(0,0,0,.15)',
                borderRadius: '50%',
                animation: 'wco-spin 700ms linear infinite',
              }}
            />
          )}
        </span>
      </button>
      {label && (
        <span
          onClick={disabled || loading ? undefined : handleClick}
          style={{ fontSize: 14, fontWeight: 500, color: sem('text'), cursor: disabled ? 'default' : 'pointer', userSelect: 'none' }}
        >
          {label}
        </span>
      )}
    </div>
  );
});