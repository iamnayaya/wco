import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type Tx = Prisma.TransactionClient;
export type Db = PrismaService | Tx;

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Shared cursor-pagination helper.
 * Offset pagination degrades on hot tables (orders, messages) because
 * concurrent inserts shift rows between pages; keyset pagination does not.
 */
export function cursorPaginate<T extends { id: string }>(rows: T[], limit: number): PaginatedResult<T> {
  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, -1) : rows;
  return { items, nextCursor: hasNext ? items[items.length - 1].id : null };
}

/** Deterministic ordering for stable keyset pages. */
export const NEWEST_FIRST: Prisma.Order[] = [{ createdAt: 'desc' }, { id: 'desc' }];
