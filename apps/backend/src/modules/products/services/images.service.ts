import type { ProductImage } from '@prisma/client';
import { NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';
import { uploadsService } from '../../../services/uploads.service.js';

import { requireProduct } from './shared.js';

/**
 * Product gallery. Files stream to S3 under `<storeId>/products/...` via the
 * shared uploads service (magic-byte re-checked there); rows carry position +
 * primary flag so the storefront and WhatsApp sync always have one hero image.
 */

export class ProductImageService {
  async create(
    storeId: string,
    productId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string },
    altText?: string,
  ): Promise<ProductImage> {
    await requireProduct(storeId, productId);
    const { key, url } = await uploadsService.upload(storeId, 'products', file);
    const existing = await prisma.productImage.findMany({ where: { productId }, take: 1 });
    return prisma.productImage.create({
      data: {
        productId,
        key,
        url,
        altText,
        position: 0,
        isPrimary: existing.length === 0,
      },
    });
  }

  async list(storeId: string, productId: string): Promise<ProductImage[]> {
    await requireProduct(storeId, productId);
    const rows = await prisma.productImage.findMany({ where: { productId } });
    return rows.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  }

  async getOwned(storeId: string, productId: string, imageId: string): Promise<ProductImage> {
    await requireProduct(storeId, productId);
    const rows = await prisma.productImage.findMany({ where: { id: imageId, productId }, take: 1 });
    const row = rows.at(0);
    if (!row) throw new NotFoundError('Image');
    return row;
  }

  async update(
    storeId: string,
    productId: string,
    imageId: string,
    patch: { altText?: string; position?: number },
  ): Promise<ProductImage> {
    await this.getOwned(storeId, productId, imageId);
    return prisma.productImage.update({ where: { id: imageId }, data: patch });
  }

  /** Deletes the DB row and the S3 object (best-effort; orphans are harmless). */
  async delete(storeId: string, productId: string, imageId: string): Promise<void> {
    const image = await this.getOwned(storeId, productId, imageId);
    await prisma.productImage.delete({ where: { id: imageId } });
    if (image.isPrimary) {
      const rest = await prisma.productImage.findMany({ where: { productId }, take: 1 });
      const next = rest.at(0);
      if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
    try {
      await uploadsService.delete(image.key);
    } catch {
      // Object already gone from the bucket - the row removal is what matters.
    }
  }

  /** Exactly one primary per product - demote siblings first. */
  async setPrimary(storeId: string, productId: string, imageId: string): Promise<ProductImage> {
    await this.getOwned(storeId, productId, imageId);
    const current = await prisma.productImage.findMany({ where: { productId, isPrimary: true } });
    for (const row of current) {
      if (row.id !== imageId) {
        await prisma.productImage.update({ where: { id: row.id }, data: { isPrimary: false } });
      }
    }
    return prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });
  }
}

export const productImageService = new ProductImageService();
