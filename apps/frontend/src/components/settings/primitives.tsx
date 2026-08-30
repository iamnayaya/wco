'use client';

import { type ReactNode, useRef } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '../../lib/utils/format';
import { Spinner } from '../../components/ui';

/* Shared accessible primitives for the settings module. Each control is small,
 * composable, and keyboard/screen-reader friendly (WCAG 2.1 AA). */

// ─── Section ─────────────────────────────────────────────────────

export function Section({
  title,
  description,
  children,
  action,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900',
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Toggle switch ───────────────────────────────────────────────

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start justify-between gap-4', disabled && 'cursor-not-allowed opacity-60')}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900 dark:text-white">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
          checked ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </label>
  );
}

// ─── Segmented choice (radio group) ──────────────────────────────

export function SegmentGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
  description,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; description?: string }>;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</legend>
      {description && <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              value === opt.value
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

// ─── Range slider ────────────────────────────────────────────────

export function RangeSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  suffix = '',
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <span className="text-sm font-semibold tabular-nums text-emerald-600">
          {Math.round(value * 100)}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600"
      />
    </div>
  );
}

// ─── Checkbox pill ───────────────────────────────────────────────

export function CheckPill({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-emerald-600"
      />
      {label}
    </label>
  );
}

// ─── Avatar / logo uploader ──────────────────────────────────────

export function ImageUploader({
  label,
  value,
  fallbackText,
  uploading,
  onChange,
}: {
  label: string;
  value?: string | null;
  fallbackText: string;
  uploading?: boolean;
  onChange: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={`Upload ${label}`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onChange(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-700"
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            {fallbackText}
          </span>
        )}
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {uploading ? <Spinner className="h-4 w-4" /> : <><Upload className="mr-1 inline h-4 w-4" />Change {label.toLowerCase()}</>}
        </span>
      </button>
    </div>
  );
}
