import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@wco/database';
import { TenantContext } from '../../common/context/tenant-context';
import type { CreateProductDto } from './dto/create-product.dto';

/**
 * ProductsService — catalog & inventory.
 *
 * Stock integrity rules:
 *  - adjustStock uses conditional decrement (never goes negative)
 *  - deletes are soft (deletedAt) to keep order history referentially honest
 */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { search?: string; status?: string; cursor?: string; limit?: number }) {
    const { storeId } = TenantContext.require();
    const limit = Math.min(params.limit ?? 25, 100);

    const items = await this.prisma.product.findMany({
      where: {
        storeId,
        deletedAt: null,
        ...(params.status ? { status: params.status as never } : {}),
        ...(params.search
          ? { OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { sku: { contains: params.search, mode: 'insensitive' } },
            ] }
          : {}),
      },
      take: limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const hasNext = items.length > limit;
    return {
      items: hasNext ? items.slice(0, -1) : items,
      nextCursor: hasNext ? items[items.length - 2]?.id ?? null : null,
    };
  }

  async create(dto: CreateProductDto) {
    const { storeId } = TenantContext.require();
    if (dto.price < 0) throw new BadRequestException('Price cannot be negative');

    try {
      return await this.prisma.product.create({
        data: {
          storeId,
          sku: dto.sku,
          name: dto.name,
          description: dto.description,
          price: new Prisma.Decimal(dto.price),
          costPrice: dto.costPrice != null ? new Prisma.Decimal(dto.costPrice) : undefined,
          stockQuantity: dto.stockQuantity ?? 0,
          trackStock: dto.trackStock ?? true,
          images: dto.images ?? [],
          categoryId: dto.categoryId,
        },
        select: { id: true, sku: true, name: true, price: true, stockQuantity: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`SKU "${dto.sku}" already exists in this store`);
      }
      throw error;
    }
  }

  async update(productId: string, dto: Partial<CreateProductDto>) {
    const { storeId } = TenantContext.require();
    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.costPrice !== undefined) data.costPrice = dto.costPrice == null ? null : new Prisma.Decimal(dto.costPrice);
    if (dto.images !== undefined) data.images = { set: dto.images };
    if (dto.status !== undefined) data.status = dto.status as never;

    const result = await this.prisma.product.updateMany({
      where: { id: productId, storeId, deletedAt: null },
      data: data as never,
    });
    if (result.count === 0) throw new NotFoundException('Product not found');
    return this.prisma.product.findUnique({ where: { id: productId } });
  }

  /**
   * Atomic stock adjustment. delta may be negative (sale/loss) or positive
   * (restock). Conditional update guarantees the invariant stock >= 0 even
   * under concurrent checkouts.
   */
  async adjustStock(productId: string, delta: number) {
    const { storeId } = TenantContext.require();
    if (delta === 0) throw new BadRequestException('Delta must be non-zero');

    if (delta > 0) {
      await this.prisma.product.updateMany({
        where: { id: productId, storeId, deletedAt: null },
        data: { stockQuantity: { increment: delta } },
      });
    } else {
      const result = await this.prisma.product.updateMany({
        where: { id: productId, storeId, stockQuantity: { gte: -delta } },
        data: { stockQuantity: { decrement: -delta } },
      });
      if (result.count === 0) throw new ConflictException('Insufficient stock for adjustment');
    }
    return this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, stockQuantity: true, lowStockThreshold: true },
    });
  }

  async lowStock(limit = 20) {
    const { storeId } = TenantContext.require();
    // Raw query: "quantity below its own row threshold" isn't expressible in
    // Prisma filters without per-row comparison.
    return this.prisma.$queryRaw<
      Array<{ id: string; name: string; stockQuantity: number; lowStockThreshold: number }>
    >`
      SELECT id, name, stock_quantity AS "stockQuantity", low_stock_threshold AS "lowStockThreshold"
      FROM products
      WHERE store_id = ${storeId} AND deleted_at IS NULL
        AND track_stock = true AND stock_quantity <= low_stock_threshold
      ORDER BY stock_quantity ASC
      LIMIT ${limit}
    `;
  }

  async softDelete(productId: string) {
    const { storeId } = TenantContext.require();
    const result = await this.prisma.product.updateMany({
      where: { id: productId, storeId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    if (result.count === 0) throw new NotFoundException('Product not found');
    return { ok: true };
  }
}
