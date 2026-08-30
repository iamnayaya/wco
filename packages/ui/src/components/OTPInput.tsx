import { forwardRef, useEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '../lib/cn';
import { sem } from '../lib/styles';
import { useControllableState } from '../lib/hooks';

/**
 * OTPInput — a multi-box one-time-password input with auto-advance,
 * backspace-to-previous, paste support, and optional auto-submit.
 */
export interface OTPInputProps {
  /** Number of digits (default 6). */
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Callback when a full code is entered. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

export const OTPInput = forwardRef<HTMLInputElement, OTPInputProps>(function OTPInput(
  { length = 6, value, defaultValue = '', onChange, onComplete, disabled = false, error = false, className, style, 'aria-label': ariaLabel = 'One-time code' },
  outerRef,
) {
  const [code, setCode] = useControllableState<string>({ value, defaultValue, onChange });
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  // Normalize to an array of `length` chars (pad empty).
  const chars = Array.from({ length }, (_, i) => code[i] ?? '');

  const emit = (next: string) => {
    setCode(next);
    if (next.length === length) onComplete?.(next);
  };

  const handleInput = (i: number, val: string) => {
    const nv = val.replace(/\D/g, '').slice(-1);
    if (!nv) return;
    const arr = chars.slice();
    arr[i] = nv;
    const next = arr.join('');
    emit(next);
    if (i < length - 1) boxes.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = chars.slice();
      arr[i] = '';
      const next = arr.join('');
      emit(next);
      if (i > 0) boxes.current[i - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      boxes.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      boxes.current[i + 1]?.focus();
    }
  };

  const handlePaste = (index: number, text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    if (!digits) return;
    emit(digits);
    const target = Math.min(index + digits.length - 1, length - 1);
    boxes.current[target]?.focus();
  };

  useEffect(() => {
    // Re-evaluate completion in case value was set externally.
    if (code.length === length) onComplete?.(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn('wco-otp', className)} role="group" aria-label={ariaLabel} style={{ display: 'flex', gap: 8, ...style }}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
            if (i === 0 && outerRef) (outerRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={error || undefined}
          disabled={disabled}
          value={chars[i]}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => {
            e.preventDefault();
            handlePaste(i, e.clipboardData.getData('text'));
          }}
          style={{
            width: 48,
            height: 56,
            textAlign: 'center',
            fontSize: 20,
            fontWeight: 600,
            fontFamily: 'var(--font-inter, system-ui)',
            color: sem('text'),
            background: sem('surface'),
            border: `2px solid ${error ? sem('dangerText') : chars[i] ? sem('primary') : sem('borderStrong')}`,
            borderRadius: 12,
            caretColor: sem('primary'),
            outline: 'none',
            transition: 'border-color 120ms ease',
            boxShadow: error ? `0 0 0 3px ${sem('dangerBg')}` : undefined,
          }}
        />
      ))}
    </div>
  );
});
