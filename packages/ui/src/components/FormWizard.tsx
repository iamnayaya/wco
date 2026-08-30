import { useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';
import { useForm, type Values, type Validator } from '../lib/form';

/**
 * FormWizard — a step-by-step form. Each step is validated before advancing
 * (a step may carry its own rules). Renders Prev/Next/Submit controls and a
 * step counter. Combine with `FormField`/inputs for the fields.
 */
export interface FormWizardStep {
  id: string;
  title: string;
  /** Optional rules run before this step can be completed. */
  rules?: Record<string, Validator<unknown> | Validator<unknown>[]>;
  render: (ctx: { values: Values; setValue: (key: string, v: unknown) => void }) => ReactNode;
}

export interface FormWizardProps {
  steps: FormWizardStep[];
  initialValues: Values;
  onSubmit?: (values: Values) => void | Promise<void>;
  nextLabel?: (stepIndex: number, last: boolean) => string;
  backLabel?: string;
  className?: string;
  style?: CSSProperties;
  showProgress?: boolean;
}

export function FormWizard({
  steps,
  initialValues,
  onSubmit,
  nextLabel,
  backLabel = 'Back',
  className,
  style,
  showProgress = true,
}: FormWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const form = useForm({
    initialValues,
    rules: steps[stepIndex]?.rules,
  });
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const goNext = () => {
    if (form.validateAll()) {
      if (isLast) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        onSubmit?.(form.values);
      } else {
        setStepIndex((i) => i + 1);
      }
    }
  };

  return (
    <div className={cn('wco-form-wizard', className)} style={{ width: '100%', ...style }}>
      {showProgress && (
        <div role="group" aria-label="Form progress" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-current={i === stepIndex ? 'step' : undefined}
                onClick={() => i < stepIndex && setStepIndex(i)}
                style={{
                  flex: 1,
                  height: 4,
                  border: 'none',
                  borderRadius: 999,
                  padding: 0,
                  cursor: i < stepIndex ? 'pointer' : 'default',
                  background: i <= stepIndex ? sem('primary') : sem('borderStrong'),
                }}
              />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: sem('textFaint') }}>
            Step {stepIndex + 1} of {steps.length} — {step.title}
          </p>
        </div>
      )}

      <div>{step.render({ values: form.values, setValue: (k, v) => form.setValue(k, v) })}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24 }}>
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          style={{
            padding: '10px 18px',
            borderRadius: 10,
            border: `1px solid ${sem('borderStrong')}`,
            background: sem('surface'),
            color: sem('text'),
            cursor: stepIndex === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-inter, system-ui)',
            fontSize: 14,
          }}
        >
          {backLabel}
        </button>
        <button
          type="button"
          onClick={goNext}
          style={{
            padding: '10px 22px',
            borderRadius: 10,
            border: 'none',
            background: sem('primary'),
            color: sem('primaryFg'),
            cursor: 'pointer',
            fontFamily: 'var(--font-inter, system-ui)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {isLast ? 'Submit' : nextLabel?.(stepIndex, isLast) ?? 'Next'}
        </button>
      </div>
    </div>
  );
}

export default FormWizard;
