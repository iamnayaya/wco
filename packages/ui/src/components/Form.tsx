import { createContext, useContext, type CSSProperties, type ReactNode, type FormEvent } from 'react';
import { useForm, validators, type UseFormOptions, type UseFormResult, type Values } from '../lib/form';
import { cn } from '../lib/cn';

/** React context that threads the form controller to descendant inputs. */
export const FormContext = createContext<UseFormResult<Values> | null>(null);

/**
 * `useFormContext` — read the nearest `<Form>`'s controller inside a field
 * render-props child. Throws when used outside a `<Form>`.
 */
export function useFormContext<T extends Values = Values>(): UseFormResult<T> {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('useFormContext must be used within a <Form>');
  return ctx as unknown as UseFormResult<T>;
}

/** Reveals common required/email/phone/number rules. */
export { validators };

/** Convenience "required" rule with a custom message. */
export const required = (msg?: string) => validators.required(msg);

export interface FormProps<V extends Values> {
  /** Naming makes strict typed wiring straightforward in TS projects. */
  children: (helpers: { form: UseFormResult<V> }) => ReactNode;
  initialValues: V;
  rules?: UseFormOptions<V>['rules'];
  onSubmit?: (values: V) => void | Promise<void>;
  className?: string;
  style?: CSSProperties;
  /** Runs validation on submit and (optionally) clears errors over time. */
  noValidate?: boolean;
}

/**
 * Form — declarative form with validation, dirty/touched tracking, and submit
 * orchestration. Combine with `useFormContext()` inside fields or use the
 * render-prop to access typed helpers.
 */
export function Form<V extends Values>({
  children,
  initialValues,
  rules,
  onSubmit,
  className,
  style,
  noValidate = false,
}: FormProps<V>) {
  const form = useForm<V>({ initialValues, rules, onSubmit }) as unknown as UseFormResult<Values>;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    form.handleSubmit();
  };

  return (
    <FormContext.Provider value={form}>
      <form className={cn('wco-form', className)} noValidate={noValidate} onSubmit={handleSubmit} style={style}>
        {children({ form: form as unknown as UseFormResult<V> })}
      </form>
    </FormContext.Provider>
  );
}

export default Form;
