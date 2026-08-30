import { useRef, useState, type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem, type ControlSize } from '../../lib/styles';
import { radii, shadows } from '../../design-tokens/layout';
import { mergeStrings, useWcoI18n, type CoreStrings } from '../../lib/i18n';
import { useClickOutside } from '../../lib/hooks';
import { Input } from '../Input';
import { CalendarMonth } from './DatePicker';
import { TimeColumns } from './TimePicker';

export interface DateTimePickerProps {
  /** Selected instant. The calendar carries the date; the columns the time. */
  value?: Date | null;
  defaultValue?: Date | null;
  onChange?: (date: Date | null) => void;
  label: string;
  locale?: string;
  firstDayOfWeek?: number;
  hour12?: boolean;
  stepMinutes?: number;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  id?: string;
  size?: ControlSize;
  className?: string;
  style?: CSSProperties;
  strings?: Partial<CoreStrings>;
}

const dismissal: CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontWeight: 600,
  fontSize: 13,
  fontFamily: 'var(--font-inter, system-ui)',
  cursor: 'pointer',
  padding: '6px 14px',
  borderRadius: radii.sm,
};

function formatInstant(date: Date, hour12: boolean, locale: string): string {
  return Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: hour12 ? 'h12' : 'h23',
  }).format(date);
}

/**
 * DateTimePicker — the calendar and clock composed in one dialog.
 * Date and time are adjusted against a shared draft until "Done" commits
 * them as a single `Date` — no wasted intermediate `onChange` emissions.
 */
export function DateTimePicker({
  value,
  defaultValue,
  onChange,
  label,
  locale: localeProp,
  firstDayOfWeek = 0,
  hour12 = true,
  stepMinutes = 5,
  min,
  max,
  disabled = false,
  id,
  size = 'md',
  className,
  style,
  strings,
}: DateTimePickerProps) {
  const { t, locale: ctxLocale } = useWcoI18n();
  const locale = localeProp ?? ctxLocale;
  const ui = mergeStrings(t, strings);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(value ?? defaultValue ?? null);
  const visible = draft ?? new Date();

  useClickOutside(rootRef, () => setOpen(false), open);

  const applyDate = (date: Date) => {
    setDraft(new Date(date.getFullYear(), date.getMonth(), date.getDate(), visible.getHours(), visible.getMinutes(), 0, 0));
  };

  const applyTime = (time: Date) => {
    setDraft(new Date(visible.getFullYear(), visible.getMonth(), visible.getDate(), time.getHours(), time.getMinutes(), 0, 0));
  };

  const commit = () => {
    setOpen(false);
    onChange?.(draft);
  };

  return (
    <div ref={rootRef} className={cn('wco-datetime-picker', className)} style={{ position: 'relative', display: 'inline-flex', width: '100%', ...style }}>
      <Input
        id={id}
        aria-label={label}
        size={size}
        disabled={disabled}
        readOnly
        value={draft ? formatInstant(draft, hour12, locale) : ''}
        placeholder={ui.select}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'ArrowDown') setOpen(true);
        }}
        style={{ width: '100%' }}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 980,
            background: sem('surface'),
            border: `1px solid ${sem('border')}`,
            borderRadius: radii.lg,
            boxShadow: shadows.popover,
            padding: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <CalendarMonth
              value={visible}
              viewDate={visible}
              locale={locale}
              firstDayOfWeek={firstDayOfWeek}
              min={min}
              max={max}
              today={new Date()}
              strings={ui}
              idPrefix="wco-dt"
              onDaySelect={applyDate}
            />
            <TimeColumns value={visible} hour12={hour12} stepMinutes={stepMinutes} onCommit={applyTime} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
            <button type="button" aria-label={ui.cancel} onClick={() => setOpen(false)} style={{ ...dismissal, color: sem('textMuted') }}>
              {ui.cancel}
            </button>
            <button
              type="button"
              disabled={draft === null}
              onClick={commit}
              style={{ ...dismissal, color: sem('primaryFg'), background: sem('primary'), transition: `background-color ${motion.fast}` }}
            >
              {ui.done}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}