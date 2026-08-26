import { ValidationError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';
import { parseCsv, toCsv } from '../../customers/csv.util.js';
import type { ListProductsV2Query } from '../products.dto.js';

import { mapUniqueViolation } from './shared.js';

/**
 * Bulk catalog movement - CSV upsert by SKU (store-scoped) and filtered
 * export. Reuses the customers module's hardened RFC 4180 parser/writer.
 */

const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
const REQUIRED_COLUMNS = ['name', 'sku', 'price'] as const;

export interface ImportReport {
  readonly created: number;
  readonly updated: number;
  readonly errors: ReadonlyArray<{ row: number; error: string }>;
}

export interface ProductCsvRow {
  readonly name: string;
  readonly sku: string;
  readonly price: number;
  readonly stockQuantity: number | null;
  readonly category: string | null;
  readonly tags: string[];
  readonly description: string | null;
}

function requireTrimmed(raw: Record<string, string>, key: string, label: string): string {
  const value = (raw[key] ?? '').trim();
  if (!value) throw new Error(`${label} is required`);
  return value;
}

/** CSV cells may be absent even though the parser types them as string. */
function cell(raw: Record<string, string>, key: string): string {
  return (raw[key] as string | undefined) ?? '';
}

/** Pure CSV row -> typed payload. Throws with a human message on bad data. */
export function mapImportRow(raw: Record<string, string>): ProductCsvRow {
  const name = requireTrimmed(raw, 'name', 'name');
  const sku = requireTrimmed(raw, 'sku', 'sku').toUpperCase();
  const price = parsePrice(cell(raw, 'price'));
  const stockQuantity = parseStock(cell(raw, 'stockquantity'));
  return {
    name,
    sku,
    price,
    stockQuantity,
    category: cell(raw, 'category').trim() || null,
    tags: splitTags(cell(raw, 'tags')),
    description: cell(raw, 'description').trim() || null,
  };
}

function parsePrice(priceRaw: string): number {
  const price = Number(priceRaw.trim());
  if (!priceRaw.trim() || !Number.isFinite(price) || price < 0) {
    throw new Error('price must be a non-negative number');
  }
  return price;
}

function parseStock(stockRaw: string): number | null {
  if (stockRaw.trim() === '') return null;
  const stockQuantity = Number.parseInt(stockRaw, 10);
  if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
    throw new Error('stockQuantity must be a non-negative integer');
  }
  return stockQuantity;
}

function splitTags(tagsRaw: string): string[] {
  return tagsRaw.split(/[;|]/).map((t) => t.trim()).filter(Boolean).slice(0, 20);
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z]/g, '');
}

export class ProductImportExportService {
  async exportCsv(storeId: string, query: Partial<ListProductsV2Query>): Promise<string> {
    const where: Record<string, unknown> = { storeId, deletedAt: null };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' as const } },
        { sku: { contains: query.q.toUpperCase() } },
      ];
    }
    const [rows, categories, links, tags] = await Promise.all([
      prisma.product.findMany({ where }),
      prisma.category.findMany({ where: { storeId } }),
      prisma.productTagOnProduct.findMany({}),
      prisma.productTag.findMany({ where: { storeId } }),
    ]);
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    const tagName = new Map(tags.map((t) => [t.id, t.name]));
    return toCsv(
      ['name', 'sku', 'price', 'stockQuantity', 'category', 'tags', 'description', 'status'],
      rows.map((p) => ({
        name: p.name,
        sku: p.sku,
        price: String(p.price),
        stockQuantity: p.stockQuantity,
        category: categoryName.get(p.categoryId ?? '') ?? '',
        tags: links
          .filter((l) => l.productId === p.id)
          .map((l) => tagName.get(l.tagId) ?? '')
          .filter(Boolean)
          .join(';'),
        description: p.description ?? '',
        status: p.status,
      })),
    );
  }

  async importCsv(
    storeId: string,
    actorId: string | null,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ): Promise<ImportReport> {
    this.assertUploadable(file);
    const parsed = parseCsv(file.buffer.toString('utf8'));
    for (const required of REQUIRED_COLUMNS) {
      if (!parsed.headers.includes(required)) {
        throw new ValidationError(`Missing required column "${required}"`);
      }
    }

    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < parsed.rows.length; i += 1) {
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.rows[i])) normalized[normalizeHeader(k)] = v;
      try {
        const payload = mapImportRow(normalized);
        const outcome = await this.upsertRow(storeId, payload);
        if (outcome === 'created') created += 1;
        else updated += 1;
      } catch (err) {
        errors.push({ row: i + 2, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
    void actorId;
    return { created, updated, errors };
  }

  private assertUploadable(file: { size: number; mimetype: string; originalname: string }): void {
    if (file.size > IMPORT_MAX_BYTES) throw new ValidationError('File exceeds the 10MB limit');
    const mime = file.mimetype.toLowerCase();
    const name = file.originalname.toLowerCase();
    const ok =
      name.endsWith('.csv') ||
      mime === 'text/csv' ||
      mime === 'application/vnd.ms-excel' ||
      mime === 'text/plain';
    if (!ok) throw new ValidationError('Only CSV files are supported (.csv)');
  }

  /** SKU is the natural key within a store - re-imports update in place. */
  private async upsertRow(
    storeId: string,
    row: ProductCsvRow,
  ): Promise<'created' | 'updated'> {
    const existing = await prisma.product.findFirst({
      where: { storeId, sku: row.sku, deletedAt: null },
    });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          price: row.price,
          ...(row.description !== null ? { description: row.description } : {}),
          ...(row.stockQuantity !== null ? { stockQuantity: row.stockQuantity } : {}),
        },
      });
      return 'updated';
    }
    let categoryId: string | null = null;
    if (row.category) {
      const found = await prisma.category.findFirst({ where: { storeId, name: row.category } });
      categoryId =
        found?.id ??
        (await prisma.category.create({ data: { storeId, name: row.category } })).id;
    }
    try {
      await prisma.product.create({
        data: {
          storeId,
          name: row.name,
          sku: row.sku,
          price: row.price,
          description: row.description,
          categoryId,
          stockQuantity: row.stockQuantity ?? 0,
          status: 'ACTIVE',
        },
      });
    } catch (err) {
      throw mapUniqueViolation(err, `SKU ${row.sku} conflicts with an archived product`) as Error;
    }
    return 'created';
  }
}

export const productImportExportService = new ProductImportExportService();
