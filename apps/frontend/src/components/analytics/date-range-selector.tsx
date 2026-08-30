'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import * as helpers from './helpers';
import { cn } from '../../lib/utils/format';

/**
 * Date-range selector with presets + custom picker and a comparison toggle.
 * Emits a fully-resolved `helpers.DateRange` upward; "compare" resolves the
 * previous equal-length period so tab queries can merge two series.
 */

interface Props {
  value: helpers.DateRange;
  compare?: boolean;
  onRangeChange: (range: helpers.DateRange) => void;
  onCompareToggle?: (on: boolean) => void;
}

export function DateRangeSelector({ value, compare = false, onRangeChange, onCompareToggle }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  function applyCustom() {
    if (!customFrom || !customTo) return;
    onRangeChange({
      key: 'custom',
      from: new Date(`${customFrom}T00:00:00`).toISOString(),
      to: new Date(`${customTo}T23:59:59`).toISOString(),
      label: `${customFrom} → ${customTo}`,
    });
    setCustomOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-1">
        {helpers.RANGE_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => onRangeChange({ ...helpers.presetRange(preset.key), key: preset.key, label: preset.label })}
            aria-pressed={!customOpen && value.key === preset.key}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              !customOpen && value.key === preset.key
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen((o) => !o)}
          aria-pressed={customOpen || value.key === 'custom'}
          aria-haspopup="true"
          aria-expanded={customOpen || value.key === 'custom'}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            customOpen || value.key === 'custom'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          <Calendar className="h-3.5 w-3.5" />
          {value.key === 'custom' ? value.label : 'Custom'}
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {onCompareToggle && (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => onCompareToggle(e.target.checked)}
            className="h-3.5 w-3.5 accent-emerald-600"
          />
          Compare previous period
        </label>
      )}

      {customOpen && (
        <div className="flex w-full flex-wrap items-end gap-2 rounded-lg border border-slate-300 bg-white p-3">
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">From</span>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="py-2" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs font-medium text-slate-600">To</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="py-2" />
          </label>
          <Button variant="secondary" onClick={applyCustom} disabled={!customFrom || !customTo}>Apply</Button>
        </div>
      )}
    </div>
  );
}
