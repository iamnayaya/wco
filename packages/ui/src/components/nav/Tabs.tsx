import { useId, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { sem } from '../../lib/styles';
import { useControllableState } from '../../lib/hooks';

/**
 * Tabs — accessible tablist with arrow-key roving, `aria-selected`, and
 * optional auto-height. Supports both controlled (`value`) and uncontrolled.
 */
export interface TabItem {
  label: ReactNode;
  value: string;
  content: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Vertical (left) orientation. */
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export function Tabs({ items, value, defaultValue, onChange, orientation = 'horizontal', ariaLabel = 'Tabs', className, style }: TabsProps) {
  const [val, setVal] = useControllableState<string>({ value, defaultValue: defaultValue ?? items[0]?.value, onChange });
  const active = val ?? items[0]?.value;
  const activeTab = items.find((t) => t.value === active) ?? items[0];

  const select = (v: string) => {
    if (items.find((t) => t.value === v && !t.disabled)) setVal(v);
  };

  const onKey = (e: React.KeyboardEvent<HTMLElement>) => {
    const enabled = items.filter((t) => !t.disabled);
    const cur = Math.max(0, enabled.findIndex((t) => t.value === active));
    let next: number | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % enabled.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    if (next === undefined) return;
    e.preventDefault();
    setVal(enabled[next].value);
  };

  const id = useId();

  const horizontal = orientation === 'horizontal';

  return (
    <div className={cn('wco-tabs', className)} style={{ display: 'flex', flexDirection: horizontal ? 'column' : 'row', gap: horizontal ? 0 : 8, width: '100%', ...style }}>
      <div
        role="tablist"
        aria-orientation={orientation}
        aria-label={ariaLabel}
        onKeyDown={(e) => onKey(e)}
        style={{
          display: 'flex',
          flexDirection: horizontal ? 'row' : 'column',
          borderBottom: horizontal ? `1px solid ${sem('border')}` : 'none',
          borderRight: horizontal ? 'none' : `1px solid ${sem('border')}`,
          gap: horizontal ? 0 : 2,
          overflowX: horizontal ? 'auto' : 'visible',
          flex: horizontal ? 'none' : '0 0 200px',
        }}
      >
        {items.map((t, i) => {
          const selected = t.value === active;
          return (
            <button
              key={t.value}
              role="tab"
              id={`${id}-tab-${t.value}`}
              aria-selected={selected}
              aria-controls={`${id}-panel-${t.value}`}
              tabIndex={selected ? 0 : -1}
              disabled={t.disabled}
              onClick={() => select(t.value)}
              onKeyDown={(e) => onKey(e)}
              style={{
                flex: horizontal ? 'none' : '1',
                padding: '10px 16px',
                border: 'none',
                background: 'transparent',
                color: selected ? sem('primary') : sem('textMuted'),
                fontWeight: selected ? 600 : 400,
                fontSize: 14,
                cursor: t.disabled ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderBottom: horizontal ? `2px solid ${selected ? sem('primary') : 'transparent'}` : 'none',
                borderRight: !horizontal ? `2px solid ${selected ? sem('primary') : 'transparent'}` : 'none',
                marginBottom: horizontal ? -1 : 0,
                opacity: t.disabled ? 0.5 : 1,
              }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-${activeTab.value}`}
        aria-labelledby={`${id}-tab-${activeTab.value}`}
        tabIndex={0}
        style={{ padding: horizontal ? '16px 0 0' : '0 16px', flex: 1, minWidth: 0 }}
      >
        {activeTab.content}
      </div>
    </div>
  );
}

export default Tabs;

