import { z } from 'zod';

import { PAGE_SIZE_MAX } from '../config/constants.js';

/**
 * Cursor pagination utilities.
 *
 * Why cursor (keyset) not offset: catalog & order lists are hot paths —
 * OFFSET degrades linearly with depth and drifts under concurrent writes.
 * Cursors are opaque (base64 of sort key) and stable. `Paginated<T>` in
 * @wco/shared is the shared contract consumed by web + mobile.
 */

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_MAX),
  cursor: z.string().max(255).optional(),
  q: z.string().max(120).optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function encodeCursor(value: string | Date): string {
  return Buffer.from(String(value instanceof Date ? value.toISOString() : value)).toString('base64url');
}

export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf8');
}

/** Standard next-cursor builder: null signals "no more pages". */
export function buildNextCursor<T extends { id: string }>(
  items: T[],
  limit: number,
): string | null {
  if (items.length < limit) return null;
  return encodeCursor(items[items.length - 1].id);
}
