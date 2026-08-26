import { Prisma } from '@prisma/client';
import { cursorPaginate, NEWEST_FIRST } from '../index';
import { PrismaService } from '../prisma.service';

type Tx = Prisma.TransactionClient;

/**
 * ProductRepository — all product reads/writes are store-scoped.
 * Services must never pass raw prisma client for catalog access;
 * this layer is where tenancy + soft-delete rules live.
 */
export class ProductRepository {
  constructor(private readonly prisma: PrismaService | Tx) {}

  async findActiveByStore(storeId: string, params: { search?: string; limit: number; cursor?: string }) {
    const rows = await this.prisma.product.findMany({
      where: {
        storeId,
        deletedAt: null,
        status: { not: 'ARCHIVED' },
        ...(params.search
          ? { name: { contains: params.search, mode: 'insensitive' as const } }
          : {}),
      },
      take: params.limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      orderBy: NEWEST_FIRST,
    });
    return cursorPaginate(rows, params.limit);
  }

  async findById(storeId: string, productId: string) {
    return this.prisma.product.findFirst({
      where: { id: productId, storeId, deletedAt: null },
      include: { category: true },
    });
  }

  async decrementStock(tx: Tx, productId: string, quantity: number): Promise<boolean> {
    const result = await tx.product.updateMany({
      where: { id: productId, stockQuantity: { gte: quantity } },
      data: { stockQuantity: { decrement: quantity } },
    });
    return result.count > 0;
  }

  async restoreStock(tx: Tx, productId: string, quantity: number): Promise<void> {
    await tx.product.update({
      where: { id: productId },
      data: { stockQuantity: { increment: quantity } },
    });
  }
}
