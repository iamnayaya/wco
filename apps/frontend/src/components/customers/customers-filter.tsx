'use client';

import { useSegments, useTags } from './hooks';
import type { ListCustomersParams } from './types';

interface CustomersFilterProps {
  params: ListCustomersParams;
  onParamsChange: (patch: Partial<ListCustomersParams>) => void;
  onClear: () => void;
}

function hasActiveFilters(p: ListCustomersParams): boolean {
  return Boolean(
    p.q ||
      p.tag ||
      p.segment ||
      p.minSpent !== undefined ||
      p.maxSpent !== undefined ||
      p.marketingOptIn !== undefined,
  );
}

export function CustomersFilter({ params, onParamsChange, onClear }: CustomersFilterProps) {
  const tagsQ = useTags();
  const segmentsQ = useSegments();

  const tagOptions = tagsQ.data?.map((t) => t.name) ?? [];
  const segmentOptions = segmentsQ.data?.map((s) => s.name) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className="input w-full sm:w-64"
          placeholder="Search name, phone or email…"
          value={params.q ?? ''}
          onChange={(e) => onParamsChange({ q: e.target.value || undefined })}
          aria-label="Search customers"
        />
        <select
          className="input w-full sm:w-auto"
          value={params.tag ?? ''}
          onChange={(e) => onParamsChange({ tag: e.target.value || undefined })}
          aria-label="Filter by tag"
        >
          <option value="">All tags</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <select
          className="input w-full sm:w-auto"
          value={params.segment ?? ''}
          onChange={(e) => onParamsChange({ segment: e.target.value || undefined })}
          aria-label="Filter by segment"
        >
          <option value="">All segments</option>
          {segmentOptions.map((segment) => (
            <option key={segment} value={segment}>
              {segment.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        {hasActiveFilters(params) && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-slate-600">
          Min spent
          <input
            type="number"
            min="0"
            inputMode="decimal"
            className="input !w-24 !py-1.5 text-xs"
            value={params.minSpent ?? ''}
            onChange={(e) => onParamsChange({ minSpent: e.target.value === '' ? undefined : Number(e.target.value) })}
            aria-label="Minimum total spent"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          Max spent
          <input
            type="number"
            min="0"
            inputMode="decimal"
            className="input !w-24 !py-1.5 text-xs"
            value={params.maxSpent ?? ''}
            onChange={(e) => onParamsChange({ maxSpent: e.target.value === '' ? undefined : Number(e.target.value) })}
            aria-label="Maximum total spent"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-600"
            checked={params.marketingOptIn === true}
            onChange={(e) => onParamsChange({ marketingOptIn: e.target.checked ? true : undefined })}
            aria-label="Marketing opted-in only"
          />
          Opted in to marketing
        </label>
      </div>
    </div>
  );
}
