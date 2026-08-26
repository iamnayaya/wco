import type { Category, ProductTag } from '@prisma/client';
import { NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';

import { mapUniqueViolation } from './shared.js';

/**
 * Catalog taxonomy - categories (v2) and the product tag catalog.
 * Categories are flat per store (informal traders rarely need trees);
 * tags are an explicit m2m so renames propagate to every tagged product.
 */

export interface CategoryV2View {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly productsCount: number;
}

export class CategoryV2Service {
  async list(storeId: string): Promise<CategoryV2View[]> {
    const [rows, products] = await Promise.all([
      prisma.category.findMany({ where: { storeId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      prisma.product.findMany({ where: { storeId, deletedAt: null }, select: { categoryId: true } }),
    ]);
    const counts = new Map<string, number>();
    for (const p of products) {
      if (p.categoryId) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    }
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      sortOrder: c.sortOrder,
      productsCount: counts.get(c.id) ?? 0,
    }));
  }

  async create(
    storeId: string,
    data: { name: string; description?: string; sortOrder?: number },
  ): Promise<Category> {
    try {
      return await prisma.category.create({
        data: {
          storeId,
          name: data.name.trim(),
          sortOrder: data.sortOrder ?? 0,
          ...(data.description !== undefined ? { description: data.description } : {}),
        },
      });
    } catch (err) {
      throw mapUniqueViolation(err, 'Category already exists in this store');
    }
  }

  async update(
    storeId: string,
    categoryId: string,
    patch: { name?: string; description?: string; sortOrder?: number },
  ): Promise<Category> {
    await this.getOwned(storeId, categoryId);
    return prisma.category.update({
      where: { id: categoryId },
      data: { ...patch, ...(patch.name ? { name: patch.name.trim() } : {}) },
    });
  }

  /** Products detach automatically - explicit null-out mirrors FK SetNull. */
  async delete(storeId: string, categoryId: string): Promise<void> {
    await this.getOwned(storeId, categoryId);
    await prisma.product.updateMany({ where: { categoryId }, data: { categoryId: null } });
    await prisma.category.delete({ where: { id: categoryId } });
  }

  async getOwned(storeId: string, categoryId: string): Promise<Category> {
    const rows = await prisma.category.findMany({ where: { id: categoryId, storeId }, take: 1 });
    const row = rows.at(0);
    if (!row) throw new NotFoundError('Category');
    return row;
  }
}

export class ProductTagCatalogService {
  async list(storeId: string): Promise<ProductTag[]> {
    return prisma.productTag.findMany({ where: { storeId }, orderBy: { name: 'asc' } });
  }

  async create(storeId: string, data: { name: string; color?: string }): Promise<ProductTag> {
    try {
      return await prisma.productTag.create({ data: { storeId, name: data.name.trim(), color: data.color } });
    } catch (err) {
      throw mapUniqueViolation(err, 'Tag already exists in this store');
    }
  }

  async update(storeId: string, tagId: string, patch: { name?: string; color?: string }): Promise<ProductTag> {
    await this.getOwned(storeId, tagId);
    try {
      return await prisma.productTag.update({
        where: { id: tagId },
        data: { ...patch, ...(patch.name ? { name: patch.name.trim() } : {}) },
      });
    } catch (err) {
      throw mapUniqueViolation(err, 'Tag already exists in this store');
    }
  }

  /** Join rows cascade; nothing dangles after delete. */
  async delete(storeId: string, tagId: string): Promise<void> {
    await this.getOwned(storeId, tagId);
    await prisma.productTag.delete({ where: { id: tagId } });
  }

  async getOwned(storeId: string, tagId: string): Promise<ProductTag> {
    const rows = await prisma.productTag.findMany({ where: { id: tagId, storeId }, take: 1 });
    const row = rows.at(0);
    if (!row) throw new NotFoundError('Tag');
    return row;
  }

  /** Replaces a product's tag links by names, upserting unknown names. */
  async assignToProduct(storeId: string, productId: string, names: string[]): Promise<ProductTag[]> {
    const clean = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
    const ids: string[] = [];
    for (const name of clean.slice(0, 20)) {
      const existing = await prisma.productTag.findFirst({ where: { storeId, name } });
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      const created = await prisma.productTag.create({ data: { storeId, name } });
      ids.push(created.id);
    }
    await prisma.productTagOnProduct.deleteMany({ where: { productId } });
    for (const tagId of ids) {
      await prisma.productTagOnProduct.create({ data: { productId, tagId } });
    }
    return this.listForProduct(productId);
  }

  async listForProduct(productId: string): Promise<ProductTag[]> {
    const links = await prisma.productTagOnProduct.findMany({ where: { productId } });
    const ids = links.map((l) => l.tagId);
    if (ids.length === 0) return [];
    const tags = await prisma.productTag.findMany({ where: { id: { in: ids } } });
    return tags.sort((a, b) => a.name.localeCompare(b.name));
  }

  async assertStoreTags(storeId: string, tagIds: string[]): Promise<void> {
    for (const id of tagIds) {
      const rows = await prisma.productTag.findMany({ where: { id, storeId }, take: 1 });
      if (!rows.at(0)) throw new NotFoundError('Tag');
    }
  }
}

export const categoryV2Service = new CategoryV2Service();
export const productTagCatalogService = new ProductTagCatalogService();
