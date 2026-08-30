import { useState, type CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { motion, sem } from '../../lib/styles';
import { radii } from '../../design-tokens/layout';
import { Icon } from '../Icon';

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  /** Accessible name for the group. */
  label: string;
  presets?: readonly string[];
  /** Show the hex input for arbitrary colors. */
  allowCustom?: boolean;
  swatchSize?: number;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_PRESETS: readonly string[] = [
  '#0f172a', '#475569', '#64748b', '#059669', '#047857', '#f59e0b',
  '#d97706', '#dc2626', '#e11d48', '#7c3aed', '#0369a1', '#0ea5e9',
];

const HEX_RE = /^#?[0-9a-f]{6}$/i;

function toHex(input: string): string | null {
  const value = input.trim();
  if (!HEX_RE.test(value)) return null;
  return `#${value.replace('#', '').toLowerCase()}`;
}

function tickColor(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? '#0f172a' : '#ffffff';
}

function swatchStyle(color: string, size: number, selected: boolean): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    border: `1px solid ${sem('border')}`,
    background: color,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tickColor(color),
    transition: `transform 80ms ${motion.base}`,
    ...(selected ? { outline: `2px solid ${sem('ring')}`, outlineOffset: 2 } : undefined),
  };
}

/**
 * ColorPicker â€” preset palette + arbitrary hex entry. Presets are toggle
 * buttons with visible selection + contrast-aware check ticks; the custom
 * row validates on commit and reverts to the current value on invalid input.
 */
export function ColorPicker({
  value,
  onChange,
  label,
  presets = DEFAULT_PRESETS,
  allowCustom = true,
  swatchSize = 26,
  className,
  style,
}: ColorPickerProps) {
  const [draft, setDraft] = useState(value);
  const normalized = toHex(value) ?? value;
  const active = normalized.toLowerCase();

  const commitCustom = () => {
    const next = toHex(draft);
    if (next) {
      onChange(next);
      setDraft(next);
    } else {
      setDraft(normalized);
    }
  };

  return (
    <div className={cn('wco-color-picker', className)} style={style} role="group" aria-label={label}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {presets.map((color) => {
          const selected = color.toLowerCase() === active;
          return (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={selected}
              onClick={() => onChange(color)}
              style={swatchStyle(color, swatchSize, selected)}
            >
              {selected && <Icon name="check" weight="bold" />}
            </button>
          );
        })}
      </div>
      {allowCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span
            aria-hidden
            style={{
              width: 20,
              height: 20,
              borderRadius: radii.sm,
              background: normalized,
              border: `1px solid ${sem('border')}`,
              flexShrink: 0,
            }}
          />
          <span aria-hidden style={{ color: sem('textFaint') }}>#</span>
          <input
            value={draft.replace(/^#/, '')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitCustom();
              if (e.key === 'Escape') setDraft(normalized);
            }}
            onBlur={commitCustom}
            aria-label={`${label} hex`}
            spellCheck={false}
            placeholder="059669"
            style={{
              flex: 1,
              height: 32,
              paddingInline: 8,
              border: `1px solid ${sem('borderStrong')}`,
              borderRadius: radii.sm,
              background: sem('surface'),
              color: sem('text'),
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 13,
            }}
          />
          <input
            type="color"
            aria-label={`${label} native`}
            value={toHex(normalized) ?? '#059669'}
            onChange={(e) => {
              const next = e.target.value;
              onChange(next);
              setDraft(next);
            }}
            style={{ width: 40, height: 32, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}
          />
        </div>
      )}
    </div>
  );
}