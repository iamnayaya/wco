import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';
import { useFormContext } from './Form';

/**
 * FormField — renders the standard label/error/help wrapper while binding a
 * `name` to its parent `<Form>` controller. The child render-prop receives
 * the current `value`, `error`, `touched`, and a `setValue` helper so any input
 * (TextField, CurrencyInput, Switch, …) plugs in with zero wiring.
 */
export interface FormFieldProps {
  /** Field name — must match a key of the form's initial values. */
  name: string;
  label: string;
  required?: boolean;
  help?: ReactNode;
  hideLabel?: boolean;
  className?: string;
  style?: CSSProperties;
  children: (control: {
    value: unknown;
    error?: string;
    touched: boolean;
    setValue: (value: unknown) => void;
    /** Pass-through for native inputs: { id, name, ... } */
    field: { id: string; name: string };
  }) => ReactNode;
}

export function FormField({ name, label, required = false, help, hideLabel = false, className, style, children }: FormFieldProps) {
  const form = useFormContext();
  const value = form.values[name];
  const error = form.errors[name];
  const touched = !!form.touched[name];
  const showError = touched && !!error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setValue = (v: unknown) => form.setValue(name as any, v as never);

  return (
    <div className={cn('wco-form-field', className)} style={{ display: 'block', marginBottom: 16, ...style }}>
      <label
        htmlFor={name}
        style={{
          display: hideLabel ? 'sr-only' : 'flex',
          alignItems: 'baseline',
          gap: 4,
          marginBottom: 6,
          fontSize: 13,
          fontWeight: 600,
          color: showError ? sem('dangerText') : sem('text'),
        }}
      >
        <span>{label}</span>
        {required && (
          <span aria-hidden style={{ color: sem('dangerText') }}>
            *
          </span>
        )}
      </label>

      {children({ value, error: showError ? error : undefined, touched, setValue, field: { id: name, name } })}

      {showError && (
        <p id={`${name}-error`} role="alert" style={{ marginTop: 6, fontSize: 12, fontWeight: 500, color: sem('dangerText') }}>
          {error}
        </p>
      )}
      {!showError && help && (
        <p style={{ marginTop: 6, fontSize: 12, color: sem('textFaint') }}>{help}</p>
      )}
    </div>
  );
}

export default FormField;
