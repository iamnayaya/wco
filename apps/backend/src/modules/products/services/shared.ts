import type { Product } from '@prisma/client';
import { ConflictError, NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

/** Shared helpers for the products module services. */

export function mapUniqueViolation(err: unknown, message: string): unknown {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  ) {
    return new ConflictError(message);
  }
  return err;
}

/** Loads a live product owned by the store or throws a leak-safe 404. */
export async function requireProduct(storeId: string, productId: string): Promise<Product> {
  const rows = await prisma.product.findMany({
    where: { id: productId, storeId, deletedAt: null },
    take: 1,
  });
  const row = rows.at(0);
  if (!row) throw new NotFoundError('Product');
  return row;
}
