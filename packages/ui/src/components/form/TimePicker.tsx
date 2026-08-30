import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem, type ControlSize } from '../../lib/styles';
import { radii, shadows } from '../../design-tokens/layout';
import { mergeStrings, useWcoI18n, type CoreStrings } from '../../lib/i18n';
import { useClickOutside } from '../../lib/hooks';
import { Input } from '../Input';

export interface TimePickerProps {
  /** Selected time as a Date (the date part is normalized to 2000-01-01). */
  value?: Date | null;
  defaultValue?: Date | null;
  onChange?: (date: Date | null) => void;
  label: string;
  hour12?: boolean;
  /** Minute tick. `1` shows every minute; `15` shows quarters. */
  stepMinutes?: number;
  placeholder?: string;
  locale?: string;
  disabled?: boolean;
  id?: string;
  size?: ControlSize;
  className?: string;
  style?: CSSProperties;
  strings?: Partial<CoreStrings>;
}

const STEP_ITEM: CSSProperties = {
  width: '100%',
  border: 'none',
  background: 'transparent',
  textAlign: 'center',
  padding: '7px 0',
  fontSize: 14,
  fontFamily: 'var(--font-inter, system-ui)',
  color: sem('text'),
  cursor: 'pointer',
  borderRadius: radii.sm,
  transition: `background-color ${motion.fast}`,
};

function stepStyle(selected: boolean): CSSProperties {
  return selected
    ? { ...STEP_ITEM, background: sem('primarySoft'), color: sem('primary'), fontWeight: 700 }
    : STEP_ITEM;
}

function formatDisplay(date: Date, hour12: boolean, locale: string): string {
  return Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: hour12 ? 'h12' : 'h23',
  }).format(date);
}

/**
 * TimeColumns — the shared hour/minute lists behind TimePicker and
 * DateTimePicker. Selected values scroll into view; every cell is a button.
 */
export function TimeColumns({
  value,
  hour12,
  stepMinutes,
  onCommit,
}: {
  value: Date;
  hour12: boolean;
  stepMinutes: number;
  onCommit: (date: Date) => void;
}) {
  const hour = value.getHours();
  const minute = value.getMinutes();
  const hourList = Array.from({ length: 24 }, (_, i) => i);
  const minuteList = Array.from({ length: 60 / stepMinutes }, (_, i) => i * stepMinutes);
  const hoursRef = useRef<HTMLDivElement | null>(null);
  const minutesRef = useRef<HTMLDivElement | null>(null);

  const apply = (h: number, m: number) => {
    const next = new Date(value);
    next.setHours(h, m, 0, 0);
    onCommit(next);
  };

  useEffect(() => {
    hoursRef.current
      ?.querySelector<HTMLElement>(`[data-h="${hour}"]`)
      ?.scrollIntoView({ block: 'nearest' });
    minutesRef.current
      ?.querySelector<HTMLElement>(`[data-h="${minute}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [hour, minute]);

  const hourLabel = (h: number) => {
    if (hour12) {
      const meridiem = h < 12 ? 'AM' : 'PM';
      return `${(h % 12 || 12).toString().padStart(2, '0')} ${meridiem}`;
    }
    return h.toString().padStart(2, '0');
  };

  const columnStyle: CSSProperties = {
    overflow: 'auto',
    maxHeight: 224,
    width: 96,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: 4,
  };

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <div ref={hoursRef} role="listbox" aria-label="Hours" style={columnStyle}>
        {hourList.map((h) => (
          <button
            key={h}
            type="button"
            role="option"
            aria-selected={h === hour}
            data-h={h}
            onClick={() => apply(h, minute)}
            style={stepStyle(h === hour)}
          >
            {hourLabel(h)}
          </button>
        ))}
      </div>
      <div ref={minutesRef} role="listbox" aria-label="Minutes" style={columnStyle}>
        {minuteList.map((m) => (
          <button
            key={m}
            type="button"
            role="option"
            aria-selected={m === minute}
            data-h={m}
            onClick={() => apply(hour, m)}
            style={stepStyle(m === minute)}
          >
            {m.toString().padStart(2, '0')}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * TimePicker — popover hour/minute stepper bound to a text field. 12h or 24h,
 * locale-formatted, step-aware minute ticks, full keyboard reachable.
 */
export function TimePicker({
  value,
  defaultValue,
  onChange,
  label,
  hour12 = true,
  stepMinutes = 5,
  placeholder,
  locale: localeProp,
  disabled = false,
  id,
  size = 'md',
  className,
  style,
  strings,
}: TimePickerProps) {
  const { t, locale: ctxLocale } = useWcoI18n();
  const locale = localeProp ?? ctxLocale;
  const ui = mergeStrings(t, strings);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Date | null>(value ?? defaultValue ?? null);
  const draft = current ?? new Date(2000, 0, 1, 9, 0, 0, 0);

  useClickOutside(rootRef, () => setOpen(false), open);

  const commit = (date: Date) => {
    setCurrent(date);
    onChange?.(date);
  };

  return (
    <div ref={rootRef} className={cn('wco-time-picker', className)} style={{ position: 'relative', display: 'inline-flex', width: '100%', ...style }}>
      <Input
        id={id}
        aria-label={label}
        size={size}
        disabled={disabled}
        readOnly
        value={current ? formatDisplay(current, hour12, locale) : ''}
        placeholder={placeholder ?? ui.select}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'ArrowDown') setOpen(true);
        }}
        suffix={
          <button type="button" aria-label={ui.open} onClick={() => setOpen((o) => !o)} disabled={disabled} style={{ border: 'none', background: 'transparent', color: sem('textFaint'), cursor: 'pointer', display: 'inline-flex' }}>
            <span aria-hidden style={{ fontSize: 15 }}>◷</span>
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
            padding: 8,
          }}
        >
          <TimeColumns value={draft} hour12={hour12} stepMinutes={stepMinutes} onCommit={commit} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                border: 'none',
                background: sem('primary'),
                color: sem('primaryFg'),
                fontWeight: 600,
                fontSize: 13,
                fontFamily: 'var(--font-inter, system-ui)',
                borderRadius: radii.sm,
                padding: '6px 14px',
                cursor: 'pointer',
              }}
            >
              {ui.done}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}