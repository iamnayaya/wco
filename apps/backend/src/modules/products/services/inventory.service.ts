import type { InventoryLedger, ProductVariant } from '@prisma/client';
import { NotFoundError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';
import type { AdjustInventoryDto } from '../products.dto.js';

import { requireProduct } from './shared.js';

/**
 * Inventory - current quantities live denormalized on product/variant rows
 * (fast list views), while `product_inventory` is the append-only ledger of
 * every movement. Variant adjustments re-sync the parent product sum so the
 * storefront never shows stale totals.
 */

export interface StockView {
  readonly productId: string;
  readonly trackStock: boolean;
  readonly quantity: number;
  readonly lowStockThreshold: number;
  readonly variants: ReadonlyArray<{
    readonly id: string;
    readonly sku: string;
    readonly name: string;
    readonly quantity: number;
    readonly lowStockThreshold: number;
  }>;
}

export interface LedgerEntry {
  readonly id: string;
  readonly delta: number;
  readonly resultingQuantity: number;
  readonly reason: string;
  readonly note: string | null;
  readonly createdAt: Date;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export class ProductInventoryService {
  /** Signed movement with floor-at-zero; writes ledger + resyncs parents. */
  async adjust(
    storeId: string,
    productId: string,
    data: AdjustInventoryDto,
    actorId?: string | null,
  ): Promise<StockView & { entry: LedgerEntry | null }> {
    const product = await requireProduct(storeId, productId);

    let targetQuantity: number;
    if (data.variantId) {
      const variant = await this.requireVariant(productId, data.variantId);
      const delta = data.delta ?? 0;
      targetQuantity = data.setQuantity !== undefined ? data.setQuantity : Math.max(0, variant.stockQuantity + delta);
      await prisma.productVariant.update({ where: { id: variant.id }, data: { stockQuantity: targetQuantity } });
      await this.resyncParentSum(productId);
    } else {
      if (!product.trackStock) {
        // Untracked products accept the write as a no-op - nothing to ledger.
        return { ...(await this.get(storeId, productId)), entry: null };
      }
      const delta = data.delta ?? 0;
      targetQuantity =
        data.setQuantity !== undefined ? data.setQuantity : Math.max(0, toNumber(product.stockQuantity) + delta);
      await prisma.product.update({
        where: { id: productId },
        data: {
          stockQuantity: targetQuantity,
          ...(targetQuantity === 0 ? { status: 'OUT_OF_STOCK' } : {}),
        },
      });
    }

    const entry = await prisma.inventoryLedger.create({
      data: {
        storeId,
        productId,
        variantId: data.variantId ?? null,
        delta: data.delta ?? targetQuantity,
        resultingQuantity: targetQuantity,
        reason: data.reason,
        note: data.note,
        actorId: actorId ?? null,
      },
    });

    const view = await this.get(storeId, productId);
    return { ...view, entry: this.toLedgerEntry(entry) };
  }

  async get(storeId: string, productId: string): Promise<StockView> {
    const product = await requireProduct(storeId, productId);
    const variants = await prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
    });
    const sorted = variants.sort((a, b) => a.name.localeCompare(b.name));
    return this.buildStockView(
      productId,
      product.trackStock,
      toNumber(product.stockQuantity),
      sorted.map((v) => ({
        id: v.id,
        sku: v.sku,
        name: v.name,
        quantity: v.stockQuantity,
        lowStockThreshold: v.lowStockThreshold,
      })),
    );
  }

  async history(storeId: string, productId: string, limit = 50): Promise<LedgerEntry[]> {
    await requireProduct(storeId, productId);
    const rows = await prisma.inventoryLedger.findMany({ where: { productId } });
    void storeId;
    return rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((e) => this.toLedgerEntry(e));
  }

  /** Flat store-wide view for ops screens. */
  async listInventory(
    storeId: string,
    query: { page: number; pageSize: number; q?: string; lowStockOnly: boolean },
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const products = await prisma.product.findMany({ where: { storeId, deletedAt: null } });
    const variants = await prisma.productVariant.findMany({ where: { deletedAt: null } });
    const byProduct = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      const list = byProduct.get(v.productId) ?? [];
      list.push(v);
      byProduct.set(v.productId, list);
    }
    let rows = products.flatMap((p) => {
      const vs = byProduct.get(p.id) ?? [];
      // Parent rows mirror the variant sum (sync policy), so count one side only.
      const totalQty = vs.length > 0 ? vs.reduce((sum, v) => sum + v.stockQuantity, 0) : p.stockQuantity;
      const threshold = vs.length > 0 ? Math.min(...vs.map((v) => v.lowStockThreshold)) : p.lowStockThreshold;
      return [{
        productId: p.id,
        name: p.name,
        sku: p.sku,
        status: p.status,
        trackStock: p.trackStock,
        quantity: totalQty,
        lowStockThreshold: threshold,
        isLow: p.trackStock && totalQty <= threshold,
        variantCount: vs.length,
      }];
    });
    if (query.q) {
      const needle = query.q.toLowerCase();
      const needleSku = query.q.toUpperCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(needle) || r.sku.includes(needleSku));
    }
    if (query.lowStockOnly) rows = rows.filter((r) => r.isLow);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    const start = (query.page - 1) * query.pageSize;
    return { items: rows.slice(start, start + query.pageSize), total: rows.length };
  }

  async lowStock(storeId: string): Promise<Array<Record<string, unknown>>> {
    const all = await this.listInventory(storeId, { page: 1, pageSize: 10000, lowStockOnly: true });
    return all.items;
  }

  private buildStockView(
    productId: string,
    trackStock: boolean,
    quantity: number,
    variants: StockView['variants'],
  ): StockView {
    return {
      productId,
      trackStock,
      quantity,
      lowStockThreshold: 5,
      variants,
    };
  }

  private toLedgerEntry(e: InventoryLedger): LedgerEntry {
    return {
      id: e.id,
      delta: e.delta,
      resultingQuantity: e.resultingQuantity,
      reason: e.reason,
      note: e.note,
      createdAt: e.createdAt,
    };
  }

  private async requireVariant(productId: string, variantId: string): Promise<ProductVariant> {
    const rows = await prisma.productVariant.findMany({
      where: { id: variantId, productId, deletedAt: null },
      take: 1,
    });
    const row = rows.at(0);
    if (!row) throw new NotFoundError('Variant');
    return row;
  }

  private async resyncParentSum(productId: string): Promise<void> {
    const variants = await prisma.productVariant.findMany({ where: { productId, deletedAt: null } });
    const sum = variants.reduce((acc, v) => acc + v.stockQuantity, 0);
    await prisma.product.update({ where: { id: productId }, data: { stockQuantity: sum } });
  }
}

export const productInventoryService = new ProductInventoryService();
