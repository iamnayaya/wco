import type { ImportResult } from './types';

/** Coerce a decimal string (e.g. "14700") into a finite number. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Human, sentence-ish label for a segment value (uppercase keys). */
export function segmentLabel(segment: string | null): string {
  if (!segment) return '—';
  return segment
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** True when a segment has a known tone in the Badge primitive. */
export function isBadgedSegment(segment: string | null): boolean {
  return segment === 'VIP' || segment === 'NEW';
}

/** Summarise an import report for a status banner. */
export function importSummary(report: ImportResult): string {
  const parts = [`${report.created} imported`];
  if (report.skippedDuplicates > 0) parts.push(`${report.skippedDuplicates} duplicates skipped`);
  if (report.errors.length > 0) parts.push(`${report.errors.length} failed`);
  return parts.join(', ');
}
