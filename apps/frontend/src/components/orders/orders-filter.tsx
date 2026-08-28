'use client';

import type { OrderChannel, OrderStatus } from './types';
import { ORDER_CHANNELS, ORDER_STATUSES } from './types';

interface OrdersFilterProps {
  status: OrderStatus | undefined;
  channel: OrderChannel | undefined;
  search: string;
  onStatusChange: (status: OrderStatus | undefined) => void;
  onChannelChange: (channel: OrderChannel | undefined) => void;
  onSearchChange: (search: string) => void;
}

const readable = (value: string) => value.replaceAll('_', ' ');

export function OrdersFilter({
  status,
  channel,
  search,
  onStatusChange,
  onChannelChange,
  onSearchChange,
}: OrdersFilterProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onStatusChange(undefined)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            !status ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onStatusChange(status === s ? undefined : s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              status === s ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {readable(s)}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          className="input w-full sm:w-auto"
          value={channel ?? ''}
          onChange={(e) => onChannelChange((e.target.value || undefined) as OrderChannel | undefined)}
          aria-label="Filter by channel"
        >
          <option value="">All channels</option>
          {ORDER_CHANNELS.map((c) => (
            <option key={c} value={c}>
              {readable(c)}
            </option>
          ))}
        </select>
        <input
          className="input w-full sm:w-60"
          placeholder="Search order or customer…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search orders"
        />
      </div>
    </div>
  );
}
