import type { ProductVariant } from '@prisma/client';
import { NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';
import type { VariantBodyDto } from '../products.dto.js';

import { mapUniqueViolation, requireProduct } from './shared.js';

/**
 * Variants - size/color/bundle SKUs under a product. Deletion is soft so
 * historical order items keep resolving; the compound (productId, sku)
 * unique only applies to live rows because archived variants keep their row.
 */

export class ProductVariantService {
  async create(storeId: string, productId: string, data: VariantBodyDto): Promise<ProductVariant> {
    await requireProduct(storeId, productId);
    try {
      return await prisma.productVariant.create({
        data: {
          productId,
          sku: data.sku.toUpperCase(),
          name: data.name,
          price: data.price ?? null,
          costPrice: data.costPrice,
          stockQuantity: data.stockQuantity,
          lowStockThreshold: data.lowStockThreshold,
          attributes: data.attributes,
        },
      });
    } catch (err) {
      throw mapUniqueViolation(err, 'SKU already exists on this product');
    }
  }

  async list(storeId: string, productId: string): Promise<ProductVariant[]> {
    await requireProduct(storeId, productId);
    const rows = await prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getOwned(storeId: string, productId: string, variantId: string): Promise<ProductVariant> {
    await requireProduct(storeId, productId);
    const rows = await prisma.productVariant.findMany({
      where: { id: variantId, productId, deletedAt: null },
      take: 1,
    });
    const row = rows.at(0);
    if (!row) throw new NotFoundError('Variant');
    return row;
  }

  async update(
    storeId: string,
    productId: string,
    variantId: string,
    patch: Partial<VariantBodyDto>,
  ): Promise<ProductVariant> {
    await this.getOwned(storeId, productId, variantId);
    try {
      return await prisma.productVariant.update({
        where: { id: variantId },
        data: { ...patch, ...(patch.sku ? { sku: patch.sku.toUpperCase() } : {}) },
      });
    } catch (err) {
      throw mapUniqueViolation(err, 'SKU already exists on this product');
    }
  }

  async delete(storeId: string, productId: string, variantId: string): Promise<void> {
    await this.getOwned(storeId, productId, variantId);
    await prisma.productVariant.update({ where: { id: variantId }, data: { deletedAt: new Date() } });
  }
}

export const productVariantService = new ProductVariantService();
