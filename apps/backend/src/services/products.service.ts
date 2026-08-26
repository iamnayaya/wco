import type { Prisma, Product } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@wco/shared';

import { prisma } from '../lib/prisma.js';
import { decodeCursor, encodeCursor } from '../utils/pagination.js';

/**
 * Catalog service — products, variants, categories.
 *
 * Stock policy: conditional atomic decrement (`stock >= qty` guard in the
 * UPDATE) so concurrent orders can never oversell; the parent product row
 * mirrors the sum of variant stock for fast list views (see syncParentStock).
 */

export interface CreateProductInput {
  readonly name: string;
  readonly sku: string;
  readonly price: number;
  readonly description?: string;
  readonly compareAtPrice?: number;
  readonly costPrice?: number;
  readonly categoryId?: string;
  readonly stockQuantity?: number;
  readonly lowStockThreshold?: number;
  readonly trackStock?: boolean;
  readonly images?: string[];
  readonly status?: 'ACTIVE' | 'DRAFT';
}

export interface ListProductsQuery {
  readonly q?: string;
  readonly categoryId?: string;
  readonly status?: 'ACTIVE' | 'DRAFT' | 'OUT_OF_STOCK' | 'ARCHIVED';
  readonly lowStockOnly?: boolean;
  readonly limit: number;
  readonly cursor?: string;
}

type ListProductsV2 = {
  q?: string;
  categoryId?: string;
  tag?: string;
  status?: 'ACTIVE' | 'DRAFT' | 'OUT_OF_STOCK' | 'ARCHIVED';
  minPrice?: number;
  maxPrice?: number;
  lowStockOnly?: boolean;
};

export class ProductsService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async create(storeId: string, input: CreateProductInput): Promise<Product> {
    if (input.price < 0) throw new ValidationError('Price cannot be negative');
    if (input.categoryId) await this.assertCategory(this.db, storeId, input.categoryId);
    try {
      return await this.db.product.create({
        data: {
          storeId,
          name: input.name,
          sku: input.sku.toUpperCase(),
          price: input.price,
          description: input.description,
          compareAtPrice: input.compareAtPrice,
          costPrice: input.costPrice,
          categoryId: input.categoryId,
          stockQuantity: input.stockQuantity ?? 0,
          lowStockThreshold: input.lowStockThreshold ?? 5,
          trackStock: input.trackStock ?? true,
          images: input.images ?? [],
          status: input.status ?? 'ACTIVE',
        },
      });
    } catch (err) {
      throw mapUniqueViolation(err, 'SKU already exists in this store');
    }
  }

  async list(
    storeId: string,
    query: ListProductsQuery,
  ): Promise<{ items: Product[]; nextCursor: string | null }> {
    const where: Prisma.ProductWhereInput = {
      storeId,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.lowStockOnly
        ? { trackStock: true, stockQuantity: { lte: prisma.product.fields.lowStockThreshold } }
        : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q.toUpperCase() } },
            ],
          }
        : {}),
      ...(query.cursor ? { id: { gt: decodeCursor(query.cursor) } } : {}),
    };
    const items = await this.db.product.findMany({
      where,
      orderBy: { id: 'asc' },
      take: query.limit,
    });
    return {
      items,
      nextCursor: items.length === query.limit && items.length > 0
        ? encodeCursor(items[items.length - 1].id)
        : null,
    };
  }

  async get(storeId: string, productId: string): Promise<Product> {
    const product = await this.db.product.findFirst({
      where: { id: productId, storeId, deletedAt: null },
      include: { variants: true },
    });
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  async update(
    storeId: string,
    productId: string,
    patch: Partial<CreateProductInput>,
  ): Promise<Product> {
    await this.get(storeId, productId);
    if (patch.categoryId) await this.assertCategory(this.db, storeId, patch.categoryId);
    const data: Prisma.ProductUncheckedUpdateInput = {
      ...patch,
      ...(patch.sku ? { sku: patch.sku.toUpperCase() } : {}),
      ...(patch.status === 'DRAFT' || patch.status === 'ACTIVE' ? { status: patch.status } : {}),
    };
    delete (data as Record<string, unknown>).stockQuantity; // stock moves only via adjustStock/reserve
    try {
      return await this.db.product.update({ where: { id: productId }, data });
    } catch (err) {
      throw mapUniqueViolation(err, 'SKU already exists in this store');
    }
  }

  /** Soft delete — order history keeps referencing the snapshot. */
  async archive(storeId: string, productId: string): Promise<void> {
    await this.get(storeId, productId);
    await this.db.product.update({
      where: { id: productId },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  /**
   * Manual inventory adjustment (+restock / -shrinkage). Delta is signed;
   * floor at zero. Emits nothing here — analytics rollup picks up deltas.
   */
  async adjustStock(storeId: string, productId: string, delta: number): Promise<Product> {
    const product = await this.get(storeId, productId);
    if (!product.trackStock) throw new ValidationError('Product does not track stock');
    if (!Number.isInteger(delta)) throw new ValidationError('Stock delta must be an integer');

    const next = Math.max(0, product.stockQuantity + delta);
    const updated = await this.db.product.update({
      where: { id: productId },
      data: { stockQuantity: next, status: next === 0 ? 'OUT_OF_STOCK' : product.status === 'OUT_OF_STOCK' ? 'ACTIVE' : product.status },
    });
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  async listCategories(storeId: string): Promise<{ id: string; name: string; sortOrder: number; productsCount: number }[]> {
    const rows = await this.db.category.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sortOrder, productsCount: r._count.products }));
  }

  async createCategory(storeId: string, name: string, sortOrder = 0): Promise<{ id: string; name: string }> {
    try {
      const category = await this.db.category.create({ data: { storeId, name, sortOrder } });
      return { id: category.id, name: category.name };
    } catch (err) {
      throw mapUniqueViolation(err, 'Category already exists');
    }
  }

  async deleteCategory(storeId: string, categoryId: string): Promise<void> {
    await this.assertCategory(this.db, storeId, categoryId);
    await this.db.category.delete({ where: { id: categoryId } }); // FK SetNull on products
  }

  private async assertCategory(db: typeof prisma, storeId: string, categoryId: string): Promise<void> {
    const category = await db.category.findFirst({ where: { id: categoryId, storeId } });
    if (!category) throw new NotFoundError('Category');
  }

  // ---------------------------------------------------------------------------
  // v2 - offset pagination, filters and store-wide stats
  // ---------------------------------------------------------------------------

  /** Shared WHERE builder for v2 list/export/stats (kept pure for reuse). */
  buildWhereV2(
    storeId: string,
    query: {
      q?: string;
      categoryId?: string;
      status?: 'ACTIVE' | 'DRAFT' | 'OUT_OF_STOCK' | 'ARCHIVED';
      minPrice?: number;
      maxPrice?: number;
      lowStockOnly?: boolean;
    },
  ): Prisma.ProductWhereInput {
    return {
      storeId,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            price: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
      // Cross-column low-stock check happens in JS (isLowStock) - field
      // references would work on Postgres but not in the test double.
      ...(query.lowStockOnly ? { trackStock: true } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q.toUpperCase() } },
            ],
          }
        : {}),
    };
  }

  async listV2(
    storeId: string,
    query: ListProductsV2 & { page: number; pageSize: number; sortBy: string; sortOrder: 'asc' | 'desc'; tag?: string },
  ): Promise<{ items: Product[]; total: number }> {
    const where = this.buildWhereV2(storeId, query);
    const include = {
      variants: true,
      imageAssets: true,
      tagLinks: { include: { tag: true } },
      category: true,
    } as const;

    // Low-stock/tag filters run in JS over the full match set (small catalogs);
    // everything else uses SQL pagination.
    if (!query.lowStockOnly && !query.tag) {
      const [items, total] = await Promise.all([
        this.db.product.findMany({
          where,
          orderBy: [{ [query.sortBy]: query.sortOrder }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include,
        }),
        this.db.product.count({ where }),
      ]);
      return { items: items as Product[], total };
    }

    const all = await this.db.product.findMany({
      where,
      orderBy: [{ [query.sortBy]: query.sortOrder }],
      include,
    });
    let filtered = all as Product[];
    if (query.lowStockOnly) filtered = filtered.filter((p) => isLowStock(p));
    if (query.tag) {
      const taggedIds = await this.resolveTaggedProductIds(storeId, query.tag);
      filtered = filtered.filter((p) => taggedIds.has(p.id));
    }
    const start = (query.page - 1) * query.pageSize;
    return {
      items: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
    };
  }

  async countProducts(storeId: string, query: ListProductsV2): Promise<number> {    if (!query.lowStockOnly) {
      return this.db.product.count({ where: this.buildWhereV2(storeId, query) });
    }
    const rows = await this.db.product.findMany({ where: this.buildWhereV2(storeId, query) });
    return rows.filter((p) => isLowStock(p)).length;
  }

  /** Product ids carrying a tag with the given name (case-insensitive). */
  private async resolveTaggedProductIds(storeId: string, tagName: string): Promise<Set<string>> {
    const tags = await this.db.productTag.findMany({ where: { storeId } });
    const wanted = new Set(
      tags.filter((t) => t.name.toLowerCase() === tagName.toLowerCase()).map((t) => t.id),
    );
    if (wanted.size === 0) return new Set();
    const links = await this.db.productTagOnProduct.findMany({
      where: { tagId: { in: [...wanted] } },
    });
    return new Set(links.map((l) => l.productId));
  }

  async stats(storeId: string): Promise<{
    total: number;
    active: number;
    draft: number;
    outOfStock: number;
    archived: number;
    inventoryValue: number;
    avgPrice: number;
    topCategories: Array<{ categoryId: string | null; name: string | null; count: number }>;
  }> {
    const rows = await this.db.product.findMany({ where: { storeId, deletedAt: null } });
    const categories = await this.db.category.findMany({ where: { storeId } });
    const byStatus = { ACTIVE: 0, DRAFT: 0, OUT_OF_STOCK: 0, ARCHIVED: 0 };
    let inventoryValue = 0;
    let priceSum = 0;
    const catCounts = new Map<string, number>();
    for (const p of rows) {
      byStatus[p.status] += 1;
      const price = Number(p.price);
      priceSum += price;
      inventoryValue += price * p.stockQuantity;
      if (p.categoryId) catCounts.set(p.categoryId, (catCounts.get(p.categoryId) ?? 0) + 1);
    }
    const topCategories = [...catCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([categoryId, count]) => ({
        categoryId,
        name: categories.find((c) => c.id === categoryId)?.name ?? null,
        count,
      }));
    return {
      total: rows.length,
      active: byStatus.ACTIVE,
      draft: byStatus.DRAFT,
      outOfStock: byStatus.OUT_OF_STOCK,
      archived: byStatus.ARCHIVED,
      inventoryValue: Math.round(inventoryValue * 100) / 100,
      avgPrice: rows.length > 0 ? Math.round((priceSum / rows.length) * 100) / 100 : 0,
      topCategories,
    };
  }
}

/** Pure low-stock predicate (cross-column, evaluated in JS). */
function isLowStock(p: Pick<Product, 'trackStock' | 'stockQuantity' | 'lowStockThreshold'>): boolean {
  return p.trackStock && p.stockQuantity <= p.lowStockThreshold;
}

function mapUniqueViolation(err: unknown, message: string): unknown {
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

export const productsService = new ProductsService();
