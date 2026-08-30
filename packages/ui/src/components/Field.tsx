import { useId, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';

export interface FieldProps {
  label: string;
  /** Auto-generates an id for the child control. Override for SSR-fixed ids. */
  id?: string;
  required?: boolean;
  /** Help/description text shown below the control. */
  help?: ReactNode;
  /** Error text — switches the control into error state and sets aria-invalid. */
  error?: ReactNode;
  /** Hides the label visually but keeps it for screen readers. */
  hideLabel?: boolean;
  children: (controlProps: { id: string }) => ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Accessible form field: label (with `htmlFor`), required indicator, help text
 * and error text. Wires `aria-describedby` ids so validation is announced.
 */
export function Field({
  label,
  id,
  required = false,
  help,
  error,
  hideLabel = false,
  children,
  className,
  style,
}: FieldProps) {
  const autoId = useId();
  const controlId = id ?? `wco-field-${autoId}`;
  const helpId = `${controlId}-help`;
  const errorId = `${controlId}-error`;
  const describedBy = [error ? errorId : null, help ? helpId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cn('wco-field', className)} style={{ display: 'block', ...style }}>
      <label
        htmlFor={controlId}
        style={{
          display: hideLabel ? 'sr-only' : 'flex',
          alignItems: 'baseline',
          gap: 4,
          marginBottom: 6,
          fontSize: 13,
          fontWeight: 600,
          color: error ? sem('dangerText') : sem('text'),
        }}
      >
        <span>{label}</span>
        {required && (
          <span aria-hidden style={{ color: sem('dangerText') }}>
            *
          </span>
        )}
      </label>

      {children({ id: controlId })}

      {error && (
        <p id={errorId} role="alert" style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: sem('dangerText') }}>
          {error}
        </p>
      )}
      {!error && help && (
        <p id={helpId} style={{ marginTop: 6, fontSize: 12, color: sem('textFaint') }}>
          {help}
        </p>
      )}
      {describedBy && (
        <span id={`${controlId}-desc`} aria-hidden className="wco-desc-sink" style={{ display: 'none' }}>
          {describedBy}
        </span>
      )}
    </div>
  );
}