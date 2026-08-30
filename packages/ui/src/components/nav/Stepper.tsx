import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';

/**
 * Stepper — a multi-step progress indicator with completed/current/upcoming
 * states. Use it standalone or with `FormWizard` for checkout/onboarding.
 */
export interface Step {
  label: ReactNode;
  description?: ReactNode;
  /** Optional custom icon for the completed state. */
  completedIcon?: ReactNode;
}

export interface StepperProps {
  steps: Step[];
  /** Zero-based current step index. */
  current: number;
  onStepClick?: (index: number) => void;
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export function Stepper({ steps, current, onStepClick, orientation = 'horizontal', ariaLabel = 'Progress', className, style }: StepperProps) {
  const horizontal = orientation === 'horizontal';

  return (
    <ol
      aria-label={ariaLabel}
      className={cn('wco-stepper', className)}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        gap: horizontal ? 0 : 16,
        ...style,
      }}
    >
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'upcoming';
        const clickable = onStepClick && i < current;
        const idx = i + 1;
        return (
          <li key={i} aria-current={state === 'current' ? 'step' : undefined} style={{ display: 'flex', alignItems: horizontal ? 'flex-start' : 'center', gap: 10, flex: horizontal ? 1 : 'none', flexDirection: horizontal ? 'column' : 'row' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(i)}
                aria-label={`Step ${idx}: ${typeof s.label === 'string' ? s.label : ''}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: clickable ? 'pointer' : state === 'current' ? 'default' : 'not-allowed',
                  background: state === 'done' ? sem('primary') : state === 'current' ? sem('surface') : sem('borderStrong'),
                  color: state === 'done' ? sem('primaryFg') : state === 'current' ? sem('primary') : sem('textFaint'),
                  border: state === 'current' ? `2px solid ${sem('primary')}` : 'none',
                  boxSizing: 'border-box',
                }}
              >
                {state === 'done' ? (s.completedIcon ?? <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>) : idx}
              </button>
              <div style={{ flex: horizontal ? 1 : 0, marginLeft: 10 }}>
                <div style={{ fontSize: 13, fontWeight: state === 'current' ? 600 : 500, color: state === 'upcoming' ? sem('textFaint') : sem('text'), whiteSpace: horizontal ? 'nowrap' : 'normal' }}>{s.label}</div>
                {s.description && <div style={{ fontSize: 12, color: sem('textFaint'), marginTop: 2 }}>{s.description}</div>}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div
                aria-hidden
                style={{
                  flex: 1,
                  minWidth: horizontal ? 24 : 2,
                  height: horizontal ? 2 : 24,
                  marginTop: horizontal ? 14 : 0,
                  marginLeft: horizontal ? 0 : 14,
                  background: i < current ? sem('primary') : sem('border'),
                  alignSelf: horizontal ? 'center' : 'stretch',
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default Stepper;
