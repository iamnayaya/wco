import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { controlSize, controlBorderRadius, motion, sem, type ControlSize } from '../../lib/styles';
import { useControllableState, useRovingTabIndex } from '../../lib/hooks';

export interface ToggleOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ToggleGroupProps {
  /** Accessible name for the group. */
  label: string;
  options: readonly ToggleOption[];
  /** Selected values. Pass this with `onChange` for a controlled group. */
  value?: readonly string[];
  defaultValue?: readonly string[];
  onChange?: (value: readonly string[]) => void;
  selectionMode?: 'single' | 'multiple';
  orientation?: 'horizontal' | 'vertical';
  size?: ControlSize;
  /** Expands buttons to share the container width (horizontal only). */
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
}

function buttonStyle(selected: boolean): CSSProperties {
  return {
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: 'none',
    background: selected ? sem('primarySoft') : 'transparent',
    color: selected ? sem('primary') : sem('textMuted'),
    fontWeight: selected ? 600 : 500,
    cursor: 'pointer',
    transition: `background-color ${motion.fast}, color ${motion.fast}`,
  };
}

/**
 * ToggleGroup — a joined control for single (`radio`) or multiple
 * (`aria-pressed`) selection. Uses the ARIA roving-tabindex pattern so one
 * button owns the tab stop and arrow keys move selection.
 */
export function ToggleGroup({
  label,
  options,
  value,
  defaultValue,
  onChange,
  selectionMode = 'multiple',
  orientation = 'horizontal',
  size = 'md',
  fullWidth = false,
  className,
  style,
}: ToggleGroupProps) {
  const [selected, setSelected] = useControllableState<readonly string[]>({
    value,
    defaultValue: defaultValue ?? [],
    onChange,
  });
  const { active, setActive, move } = useRovingTabIndex(options.length);
  const s = controlSize[size];
  const single = selectionMode === 'single';
  const isSelected = (v: string) => selected.includes(v);

  const toggleValue = (v: string) => {
    if (isSelected(v)) {
      setSelected(single ? [] : selected.filter((x) => x !== v));
    } else {
      setSelected(single ? [v] : [...selected, v]);
    }
  };

  const container: CSSProperties = {
    display: 'inline-flex',
    flexDirection: orientation === 'vertical' ? 'column' : 'row',
    alignItems: 'stretch',
    width: fullWidth && orientation === 'horizontal' ? '100%' : undefined,
    border: `1px solid ${sem('borderStrong')}`,
    borderRadius: controlBorderRadius[size],
    overflow: 'hidden',
    background: sem('surface'),
    ...style,
  };

  return (
    <div
      role={single ? 'radiogroup' : 'group'}
      aria-label={label}
      className={cn('wco-toggle-group', className)}
      style={container}
    >
      {options.map((option, i) => (
        <button
          key={option.value}
          type="button"
          role={single ? 'radio' : undefined}
          aria-checked={single ? isSelected(option.value) : undefined}
          aria-pressed={single ? undefined : isSelected(option.value)}
          tabIndex={option.disabled ? -1 : active === i ? 0 : -1}
          disabled={option.disabled}
          onFocus={() => setActive(i)}
          onKeyDown={(e) => {
            const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
            const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
            if (e.key === prevKey) {
              e.preventDefault();
              move(-1);
            } else if (e.key === nextKey) {
              e.preventDefault();
              move(1);
            }
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.985)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = '';
          }}
          onClick={() => toggleValue(option.value)}
          style={{
            ...buttonStyle(isSelected(option.value)),
            height: s.height,
            paddingInline: s.px,
            fontSize: s.fontSize,
            fontFamily: 'var(--font-inter, system-ui)',
            ...(orientation === 'vertical' && i + 1 < options.length
              ? { borderBottom: `1px solid ${sem('border')}` }
              : { borderLeft: i > 0 ? `1px solid ${sem('border')}` : undefined }),
          }}
        >
          {option.icon && <span aria-hidden style={{ display: 'inline-flex' }}>{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  );
}