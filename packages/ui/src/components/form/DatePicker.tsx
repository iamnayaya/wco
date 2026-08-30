import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';
import { focusRing, motion, sem, type ControlSize } from '../../lib/styles';
import { radii, shadows } from '../../design-tokens/layout';
import { mergeStrings, useWcoI18n, type CoreStrings } from '../../lib/i18n';
import { useClickOutside, useControllableState, useId } from '../../lib/hooks';
import { Icon } from '../Icon';
import { Input } from '../Input';

export interface DatePickerProps {
  /** Selected date (controlled). Pass `null` to express "none". */
  value?: Date | null;
  defaultValue?: Date | null;
  onChange?: (date: Date | null) => void;
  min?: Date;
  max?: Date;
  locale?: string;
  /** 0 = Sunday, 1 = Monday — match your region's calendar start. */
  firstDayOfWeek?: number;
  placeholder?: string;
  /** Accessible name for the field. */
  label: string;
  disabled?: boolean;
  id?: string;
  size?: ControlSize;
  className?: string;
  style?: CSSProperties;
  strings?: Partial<CoreStrings>;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface CalendarCell {
  date: Date;
  inMonth: boolean;
}

function buildMonthCells(year: number, month: number, firstDayOfWeek: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() - firstDayOfWeek + 7) % 7;
  const cursor = addDays(first, -startOffset);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    cells.push({ date: new Date(cursor), inMonth: cursor.getMonth() === month });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

const dayCellBase: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: radii.sm,
  border: 'none',
  fontSize: 14,
  fontFamily: 'var(--font-inter, system-ui)',
  cursor: 'pointer',
  transition: `background-color ${motion.fast}, color ${motion.fast}`,
};

function dayStyle(state: 'idle' | 'muted' | 'selected' | 'today' | 'disabled', focused: boolean): CSSProperties {
  const focusedStyle = focused ? focusRing : undefined;
  switch (state) {
    case 'selected':
      return { ...dayCellBase, background: sem('primary'), color: sem('primaryFg'), ...focusedStyle };
    case 'today':
      return { ...dayCellBase, color: sem('primary'), fontWeight: 700, ...focusedStyle };
    case 'muted':
      return { ...dayCellBase, color: sem('textFaint'), ...focusedStyle };
    case 'disabled':
      return { ...dayCellBase, color: sem('textFaint'), opacity: 0.4, cursor: 'default', ...focusedStyle };
    default:
      return { ...dayCellBase, color: sem('text'), ...focusedStyle };
  }
}

/**
 * CalendarMonth — the self-contained month grid behind DatePicker and
 * DateTimePicker. Roving-tabindex day navigation (arrows, Home/End, Enter)
 * over a 6×7 grid, `aria-label`led cells, reduced-motion-safe.
 */
export function CalendarMonth({
  value,
  viewDate,
  locale,
  firstDayOfWeek,
  min,
  max,
  today,
  strings,
  idPrefix,
  onDaySelect,
}: {
  value: Date | null;
  viewDate: Date;
  locale: string;
  firstDayOfWeek: number;
  min?: Date;
  max?: Date;
  today: Date;
  strings: CoreStrings;
  idPrefix: string;
  onDaySelect: (date: Date) => void;
}) {
  const [focused, setFocused] = useState(() => value ?? viewDate);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const cells = buildMonthCells(viewDate.getFullYear(), viewDate.getMonth(), firstDayOfWeek);
  const fmtDay = (d: Date) => Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const weekdayLabel = (d: Date) => Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);

  const enabled = (d: Date) =>
    (min === undefined || d >= min) && (max === undefined || d <= max);

  const focusCell = (date: Date) => {
    const target = refs.current.get(String(date.getTime()));
    if (target && enabled(date)) {
      setFocused(date);
      target.focus();
    }
  };

  const onGridKey = (e: KeyboardEvent) => {
    const moves: Record<string, Date> = {
      ArrowLeft: addDays(focused, -1),
      ArrowRight: addDays(focused, 1),
      ArrowUp: addDays(focused, -7),
      ArrowDown: addDays(focused, 7),
    };
    const next = moves[e.key];
    if (next) {
      e.preventDefault();
      focusCell(next);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusCell(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1));
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
      focusCell(last);
    }
  };

  useLayoutEffect(() => {
    if (value) setFocused(value);
  }, [value]);

  return (
    <div role="group" aria-label={`${Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewDate)}`} onKeyDown={onGridKey}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 36px)',
          gridAutoRows: 36,
          gap: 2,
          justifyContent: 'center',
        }}
      >
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(new Date(2020, 1, 2), (i + firstDayOfWeek) % 7);
          return (
            <div
              key={i}
              aria-hidden
              style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: sem('textFaint') }}
            >
              {weekdayLabel(d)}
            </div>
          );
        })}
        {cells.map((cell, i) => {
          const disabled = !enabled(cell.date);
          const state = disabled
            ? 'disabled'
            : sameDay(cell.date, today)
              ? 'today'
              : cell.inMonth
                ? 'idle'
                : 'muted';
          const isFocused = sameDay(focused, cell.date) && enabled(cell.date) && !disabled;
          return (
            <button
              key={i}
              ref={(el) => {
                if (el) refs.current.set(String(cell.date.getTime()), el);
                else void refs.current.delete(String(cell.date.getTime()));
              }}
              type="button"
              aria-label={fmtDay(cell.date)}
              aria-pressed={value !== null && sameDay(cell.date, value)}
              aria-disabled={disabled || undefined}
              tabIndex={isFocused ? 0 : -1}
              onClick={() => {
                if (!disabled) {
                  setFocused(cell.date);
                  onDaySelect(cell.date);
                }
              }}
              style={dayStyle(state, isFocused)}
            >
              {cell.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * DatePicker — calendar popover bound to a text field. Locale-aware labels
 * (via Intl), optional min/max, full roving keyboard navigation, and the
 * same triple-fallback theming as the rest of the library.
 */
export function DatePicker({
  value,
  defaultValue,
  onChange,
  min,
  max,
  locale: localeProp,
  firstDayOfWeek = 0,
  placeholder,
  label,
  disabled = false,
  id,
  size = 'md',
  className,
  style,
  strings,
}: DatePickerProps) {
  const { t, locale: ctxLocale } = useWcoI18n();
  const locale = localeProp ?? ctxLocale;
  const ui = mergeStrings(t, strings);
  const uid = useId('wco-date');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useControllableState<Date | null>({
    value: value === undefined ? undefined : value,
    defaultValue: defaultValue ?? null,
    onChange,
  });
  const [viewDate, setViewDate] = useState(() => current ?? new Date());

  useClickOutside(rootRef, () => setOpen(false), open);

  const shiftMonth = (delta: number) => {
    setViewDate((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  };

  const select = (date: Date) => {
    setCurrent(date);
    setViewDate(date);
    setOpen(false);
  };

  const inputStyle = current
    ? Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(current)
    : '';

  return (
    <div ref={rootRef} className={cn('wco-date-picker', className)} style={{ position: 'relative', display: 'inline-flex', width: '100%', ...style }}>
      <Input
        id={id}
        aria-label={label}
        size={size}
        disabled={disabled}
        readOnly
        value={inputStyle}
        placeholder={placeholder ?? ui.today}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'ArrowDown') setOpen(true);
        }}
        onClick={() => setOpen(true)}
        suffix={
          <button type="button" aria-label={ui.open} onClick={() => setOpen((o) => !o)} disabled={disabled} style={{ border: 'none', background: 'transparent', color: sem('textFaint'), cursor: 'pointer', display: 'inline-flex' }}>
            <Icon name="calendar" aria-hidden />
          </button>
        }
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
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button
              type="button"
              aria-label={ui.previous}
              onClick={() => shiftMonth(-1)}
              style={{ ...dayCellBase }}
            >
              <Icon name="chevronLeft" aria-hidden />
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-inter, system-ui)', color: sem('text') }}>
              {Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewDate)}
            </span>
            <button
              type="button"
              aria-label={ui.next}
              onClick={() => shiftMonth(1)}
              style={{ ...dayCellBase }}
            >
              <Icon name="chevronRight" aria-hidden />
            </button>
          </div>
          <CalendarMonth
            value={current}
            viewDate={viewDate}
            locale={locale}
            firstDayOfWeek={firstDayOfWeek}
            min={min}
            max={max}
            today={new Date()}
            strings={ui}
            idPrefix={uid}
            onDaySelect={select}
          />
        </div>
      )}
    </div>
  );
}