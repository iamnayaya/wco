import { z } from 'zod';

import type { PaginationMeta } from './api-response.js';

/**
 * Offset pagination for admin/console list endpoints.
 *
 * Why offset here when the catalog uses cursors: admin tables need
 * page/pageSize/total/totalPages metadata (jump-to-page UIs, CSV export) and
 * are low-QPS. Hot merchant-facing lists keep keyset cursors.
 */
export const PAGE_DEFAULT = 20;
export const PAGE_MAX = 100;

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PAGE_MAX).default(PAGE_DEFAULT),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export function paginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return {
    page,
    pageSize,
    totalItems: total,
    totalPages: Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
  };
}
