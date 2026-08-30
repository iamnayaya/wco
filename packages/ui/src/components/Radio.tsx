import { createContext, useContext, useId, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';

interface RadioGroupContextValue {
  name: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
  disabled: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps {
  name: string;
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /** Accessible label rendered above the group, or `aria-label` if not a string. */
  label?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Manageable radio group with shared `name`, value, and keyboard-native inputs. */
export function RadioGroup({
  name,
  value,
  onValueChange,
  disabled = false,
  label,
  className,
  style,
  children,
}: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ name, value, onValueChange, disabled }}>
      <div
        role="radiogroup"
        aria-label={typeof label === 'string' ? label : undefined}
        className={cn('wco-radio-group', className)}
        style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}
      >
        {label && typeof label !== 'string' && label}
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioProps {
  value: string;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
}

export function Radio({ value, label, description, disabled = false, id }: RadioProps) {
  const ctx = useContext(RadioGroupContext);
  if (!ctx) throw new Error('Radio must be used inside <RadioGroup>.');
  const autoId = useId();
  const inputId = id ?? `wco-radio-${autoId}`;
  const isSelected = ctx.value === value;
  const isDisabled = disabled || ctx.disabled;

  const feedback: CSSProperties = {
    width: 18,
    height: 18,
    flexShrink: 0,
    marginTop: 1,
    borderRadius: '50%',
    border: `1px solid ${isDisabled ? sem('borderStrong') : sem('outline')}`,
    background: sem('surface'),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 120ms ease',
  };

  return (
    <label
      htmlFor={inputId}
      style={{
        display: 'inline-flex',
        gap: 10,
        alignItems: 'flex-start',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <input
          id={inputId}
          type="radio"
          name={ctx.name}
          value={value}
          checked={isSelected}
          disabled={isDisabled}
          onChange={() => ctx.onValueChange(value)}
          aria-label={typeof label === 'string' ? label : undefined}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'inherit', zIndex: 1 }}
        />
        <span aria-hidden style={feedback}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: sem('primary'),
              transform: isSelected ? 'scale(1)' : 'scale(0)',
              transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
        </span>
      </span>
      {(label || description) && (
        <span style={{ display: 'block' }}>
          {label && (
            <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: sem('text') }}>{label}</span>
          )}
          {description && (
            <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: sem('textFaint') }}>{description}</span>
          )}
        </span>
      )}
    </label>
  );
}