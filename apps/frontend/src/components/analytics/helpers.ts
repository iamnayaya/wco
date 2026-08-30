import dayjs from 'dayjs';
import { formatMoney } from '../../lib/utils/format';
import type {
  InsightSeverity,
  InsightType,
  ReportFrequency,
  ReportStatus,
  ReportType,
} from './types';

/**
 * Date-range presets + formatting helpers for the analytics page.
 * dayjs is the app date library (ISO date strings everywhere).
 */

export type RangeKey = '7d' | '30d' | '90d' | 'thisMonth' | 'lastMonth';

export interface DateRange {
  key: RangeKey | 'custom' | 'compare';
  from: string; // ISO
  to: string; // ISO
  label: string;
}

export interface RangePreset {
  key: RangeKey;
  label: string;
}

export const RANGE_PRESETS: RangePreset[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
];

/** Inclusive end-of-day so daily buckets include the last day. */
export function presetRange(key: RangeKey): { from: string; to: string } {
  const now = dayjs();
  switch (key) {
    case '7d':
      return { from: now.subtract(7, 'day').startOf('day').toISOString(), to: now.endOf('day').toISOString() };
    case '30d':
      return { from: now.subtract(30, 'day').startOf('day').toISOString(), to: now.endOf('day').toISOString() };
    case '90d':
      return { from: now.subtract(90, 'day').startOf('day').toISOString(), to: now.endOf('day').toISOString() };
    case 'thisMonth':
      return { from: now.startOf('month').toISOString(), to: now.endOf('month').toISOString() };
    case 'lastMonth':
      return { from: now.subtract(1, 'month').startOf('month').toISOString(), to: now.subtract(1, 'month').endOf('month').toISOString() };
    default:
      return { from: now.subtract(30, 'day').startOf('day').toISOString(), to: now.endOf('day').toISOString() };
  }
}

/** Previous period of equal length for comparison. */
export function previousPeriod(range: { from: string; to: string }): { from: string; to: string } {
  const len = dayjs(range.to).diff(dayjs(range.from), 'millisecond');
  return {
    from: dayjs(range.from).subtract(len, 'millisecond').toISOString(),
    to: dayjs(range.from).subtract(1, 'millisecond').toISOString(),
  };
}

/** Shorten a raw ISO bucket date into `MMM D` (or `MMM D, YYYY`) for axes. */
export function formatAxis(iso: string, withYear = false): string {
  const d = dayjs(iso);
  if (!d.isValid()) return iso;
  return withYear ? d.format('MMM D, YY') : d.format('MMM D');
}

/** A safe short axis label for long date ranges. */
export function shortAxis(iso: string, count: number): string {
  if (count > 60) return dayjs(iso).format('MMM YY');
  return dayjs(iso).format('MMM D');
}

export function money(n: number | null | undefined, currency = 'NGN'): string {
  return formatMoney(Math.round(n ?? 0), currency);
}

export function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ─── Domain label maps ───────────────────────────────────────────

export const INSIGHT_TYPE_LABEL: Record<InsightType, string> = {
  TREND: 'Trend',
  ANOMALY: 'Anomaly',
  OPPORTUNITY: 'Opportunity',
  RISK: 'Risk',
  RECOMMENDATION: 'Recommendation',
};

export const SEVERITY_LABEL: Record<InsightSeverity, string> = {
  INFO: 'Info',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  SALES: 'Sales',
  CUSTOMERS: 'Customers',
  PRODUCTS: 'Products',
  MESSAGES: 'Messages',
  PAYMENTS: 'Payments',
  DELIVERIES: 'Deliveries',
  COMPREHENSIVE: 'Comprehensive',
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: 'Pending',
  GENERATING: 'Generating',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

export const FREQUENCY_LABEL: Record<ReportFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  ONCE: 'Once',
};

export const REPORT_TYPES: ReportType[] = [
  'SALES',
  'CUSTOMERS',
  'PRODUCTS',
  'MESSAGES',
  'PAYMENTS',
  'DELIVERIES',
  'COMPREHENSIVE',
];

export const FREQUENCIES: ReportFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
export const FORMATS = ['CSV', 'JSON', 'PDF'] as const;
