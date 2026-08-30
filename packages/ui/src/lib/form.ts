import { useCallback, useMemo, useState } from 'react';

/**
 * WCO form state — a lightweight, typed form controller with:
 * - values / errors / touched tracking
 * - `setValue`, `setValues`, `onChange` helpers
 * - `touch`/`setTouched`, `reset`, `validateAll`
 * - `isValid` + `submit` orchestration
 *
 * It is framework-agnostic and works with any input component (`Field`-based).
 * Validation handlers are `(value) => string | undefined` returning an error
 * message (or undefined when valid).
 */

export type Validator<T> = (value: T) => string | undefined;
export type Values = Record<string, unknown>;
export type ValidationRules<V extends Values> = Partial<{ [K in keyof V]: Validator<V[K]> | Validator<V[K]>[] }>;

export interface UseFormOptions<V extends Values> {
  initialValues: V;
  rules?: ValidationRules<V>;
  onSubmit?: (values: V) => void | Promise<void>;
}

export interface UseFormResult<V extends Values> {
  values: V;
  errors: Partial<Record<keyof V, string>>;
  touched: Partial<Record<keyof V, boolean>>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
  setValue: <K extends keyof V>(name: K, value: V[K]) => void;
  setValues: (patch: Partial<V>) => void;
  setTouched: <K extends keyof V>(name: K, touched?: boolean) => void;
  onChange: (name: keyof V) => (value: unknown) => void;
  validateField: <K extends keyof V>(name: K) => string | undefined;
  validateAll: () => boolean;
  reset: (next?: V) => void;
  handleSubmit: (e?: { preventDefault?: () => void }) => Promise<void>;
}

/** Single-value validator runner. Returns first error message or undefined. */
export function runValidators<T>(validators: Validator<T>[] | undefined, value: T): string | undefined {
  if (!validators || validators.length === 0) return undefined;
  for (const v of validators) {
    const err = v(value);
    if (err) return err;
  }
  return undefined;
}

export function useForm<V extends Values>(options: UseFormOptions<V>): UseFormResult<V> {
  const { initialValues, rules, onSubmit } = options;
  const [values, setValuesState] = useState<V>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof V, string>>>({});
  const [touched, setTouchedState] = useState<Partial<Record<keyof V, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const validateField = useCallback(
    <K extends keyof V>(name: K): string | undefined => {
      const rule = rules?.[name];
      const validators = Array.isArray(rule) ? rule : rule ? [rule] : undefined;
      const err = runValidators(validators, values[name]);
      setErrors((prev) => {
        const next = { ...prev };
        if (err) next[name] = err;
        else delete next[name];
        return next;
      });
      return err;
    },
    [rules, values],
  );

  const validateAll = useCallback((): boolean => {
    const nextErrors: Partial<Record<keyof V, string>> = {};
    let ok = true;
    if (rules) {
      for (const name of Object.keys(rules) as Array<keyof V>) {
        const validators = Array.isArray(rules[name]) ? rules[name] : rules[name] ? [rules[name] as Validator<V[keyof V]>] : undefined;
        const err = runValidators(validators as Validator<V[keyof V]>[] | undefined, values[name]);
        if (err) {
          nextErrors[name] = err;
          ok = false;
        }
      }
    }
    setErrors(nextErrors);
    setTouchedState(Object.fromEntries(Object.keys(values).map((k) => [k, true])) as Partial<Record<keyof V, boolean>>);
    return ok;
  }, [rules, values]);

  const setValue = useCallback(
    <K extends keyof V>(name: K, value: V[K]) => {
      setValuesState((prev) => ({ ...prev, [name]: value }));
      setIsDirty(true);
      setTouchedState((prev) => ({ ...prev, [name]: true }));
      // Clear error on change; revalidate the changed field.
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    },
    [],
  );

  const setValues = useCallback((patch: Partial<V>) => {
    setValuesState((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
  }, []);

  const setTouched = useCallback(
    <K extends keyof V>(name: K, t = true) => {
      setTouchedState((prev) => ({ ...prev, [name]: t }));
    },
    [],
  );

  const onChange = useCallback((name: keyof V) => (value: unknown) => setValue(name as keyof V, value as V[keyof V]), [setValue]);

  const reset = useCallback(
    (next?: V) => {
      setValuesState(next ?? initialValues);
      setErrors({});
      setTouchedState({});
      setIsDirty(false);
    },
    [initialValues],
  );

  const handleSubmit = useCallback(
    async (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      if (!validateAll()) return;
      setIsSubmitting(true);
      try {
        await onSubmit?.(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [validateAll, onSubmit, values],
  );

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid: !hasErrors && isDirty,
    setValue,
    setValues,
    setTouched,
    onChange,
    validateField,
    validateAll,
    reset,
    handleSubmit,
  };
}

/** Convenience validators. */
export const validators = {
  required: (msg = 'This field is required') => (v: unknown) => (v === undefined || v === null || v === '' ? msg : undefined),
  email: (msg = 'Enter a valid email') => (v: unknown) => {
    if (typeof v !== 'string' || v === '') return undefined;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? undefined : msg;
  },
  minLen: (n: number, msg?: string) => (v: unknown) => (typeof v === 'string' && v.length < n ? msg ?? `At least ${n} characters` : undefined),
  maxLen: (n: number, msg?: string) => (v: unknown) => (typeof v === 'string' && v.length > n ? msg ?? `At most ${n} characters` : undefined),
  phone: (msg = 'Enter a valid phone number') => (v: unknown) => {
    if (typeof v !== 'string' || v === '') return undefined;
    return /^\+?\d{10,13}$/.test(v.replace(/\s/g, '')) ? undefined : msg;
  },
  number: (msg = 'Must be a number') => (v: unknown) => (typeof v === 'string' && v !== '' && isNaN(Number(v)) ? msg : undefined),
} as const;
