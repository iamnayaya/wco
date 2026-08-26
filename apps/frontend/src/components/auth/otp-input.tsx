'use client';

import { useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { cn } from '../../lib/utils/format';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OTPInput({ length = 6, value, onChange, disabled }: OTPInputProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, '').slice(0, length);
      onChange(val);
    },
    [length, onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !value) {
        e.preventDefault();
      }
    },
    [value],
  );

  const digits = value.split('');
  const display = Array.from({ length }).map((_, i) => digits[i] ?? '');

  return (
    <div className="flex justify-center gap-2">
      {display.map((digit, i) => (
        <div
          key={i}
          className={cn(
            'flex h-12 w-10 items-center justify-center rounded-lg border-2 text-center text-lg font-bold transition-colors',
            focused && i === digits.length
              ? 'border-emerald-500'
              : digit
              ? 'border-emerald-300 dark:border-emerald-700'
              : 'border-slate-200 dark:border-slate-700',
          )}
        >
          {digit}
        </div>
      ))}
      {/* Hidden accessible input */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        className="sr-only"
        aria-label={`Verification code, ${length} digits`}
      />
      {/* Click target */}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className="absolute inset-0"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
