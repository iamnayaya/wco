import { ValidationError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';
import { ordersService } from '../../../services/orders.service.js';
import { parseCsv, toCsv } from '../../customers/csv.util.js';
import type { ListOrdersV2Query, OrderCsvRow } from '../orders.dto.js';


/**
 * Bulk order movement - filtered CSV export and CSV import that creates real
 * orders through OrdersService (so stock guards, money math and customer
 * resolution behave exactly like the API). Reuses the customers module's
 * RFC 4180 parser/writer.
 */

const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
const REQUIRED_COLUMNS = ['customerphone', 'items'] as const;

function cell(raw: Record<string, string>, key: string): string {
  return (raw[key] as string | undefined) ?? '';
}

/** "RICE:2; OIL:1" -> [{sku, quantity}]. Throws with a human message. */
export function parseItemsSpec(spec: string): Array<{ sku: string; quantity: number }> {
  const entries = spec
    .split(/[;\n]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (entries.length === 0) throw new Error('items must list at least one SKU:QTY pair');
  return entries.map((entry) => {
    const [skuRaw, qtyRaw] = entry.split(/[:xX]/).map((part) => part.trim());
    const sku = skuRaw.toUpperCase();
    const quantity = Number.parseInt(qtyRaw, 10);
    if (!sku) throw new Error(`invalid item "${entry}" - missing SKU`);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`invalid item "${entry}" - quantity must be a positive integer`);
    }
    if (quantity > 999) throw new Error(`invalid item "${entry}" - quantity over 999`);
    return { sku, quantity };
  });
}

/** Pure CSV row -> typed payload. Throws with a human message on bad data. */
export function mapImportRow(raw: Record<string, string>): OrderCsvRow {
  const customerPhone = cell(raw, 'customerphone').replace(/\s+/g, '');
  if (!customerPhone) throw new Error('customerPhone is required');
  const itemsSpec = cell(raw, 'items');
  if (!itemsSpec.trim()) throw new Error('items is required');
  const discount = parseMoney(cell(raw, 'discount'), 'discount');
  const deliveryFee = parseMoney(cell(raw, 'deliveryfee'), 'deliveryFee');
  const channelRaw = cell(raw, 'channel').trim().toUpperCase();
  const channel = ['WHATSAPP', 'DASHBOARD', 'PAYMENT_LINK'].includes(channelRaw) ? channelRaw : 'DASHBOARD';
  return {
    customerPhone,
    itemsSpec,
    discount,
    deliveryFee,
    address: cell(raw, 'address').trim() || null,
    city: cell(raw, 'city').trim() || null,
    channel,
  };
}

function parseMoney(value: string, label: string): number | null {
  if (value.trim() === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) throw new Error(`${label} must be a non-negative number`);
  return num;
}

export class OrderImportExportService {
  async exportCsv(storeId: string, query: Partial<ListOrdersV2Query>): Promise<string> {
    const where = ordersService.buildWhere(storeId, query);
    const rows = await prisma.order.findMany({ where, orderBy: [{ createdAt: 'desc' }] });
    const customerIds = Array.from(new Set(rows.map((r) => r.customerId)));
    const customers = customerIds.length
      ? await prisma.customer.findMany({ where: { id: { in: customerIds } } })
      : [];
    const nameByCustomer = new Map(customers.map((c) => [c.id, c.name]));
    const phoneByCustomer = new Map(customers.map((c) => [c.id, c.waPhone]));

    const lines = await Promise.all(
      rows.map(async (order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        customerName: nameByCustomer.get(order.customerId) ?? '',
        customerPhone: phoneByCustomer.get(order.customerId) ?? '',
        items: await this.renderItems(order.id),
        subtotal: String(order.subtotal),
        discount: String(order.discount),
        deliveryFee: String(order.deliveryFee),
        total: String(order.total),
        deliveryAddress: order.deliveryAddress ?? '',
        deliveryCity: order.deliveryCity ?? '',
        createdAt: order.createdAt.toISOString(),
      })),
    );
    return toCsv(
      [
        'orderNumber',
        'status',
        'customerName',
        'customerPhone',
        'items',
        'subtotal',
        'discount',
        'deliveryFee',
        'total',
        'deliveryAddress',
        'deliveryCity',
        'createdAt',
      ],
      lines,
    );
  }

  /**
   * One row per ORDER; SKUs resolve within the store, then each row goes
   * through the regular checkout path. A bad row never aborts the batch.
   */
  async importCsv(storeId: string, file: { buffer: Buffer; mimetype: string; originalname: string; size: number }): Promise<{ created: number; failedRows: ReadonlyArray<{ row: number; error: string }> }> {
    this.assertUploadable(file);
    const parsed = parseCsv(file.buffer.toString('utf8'));
    for (const required of REQUIRED_COLUMNS) {
      if (!parsed.headers.includes(required)) {
        throw new ValidationError(`Missing required column "${required}"`);
      }
    }
    let created = 0;
    const failedRows: Array<{ row: number; error: string }> = [];
    for (let idx = 0; idx < parsed.rows.length; idx += 1) {
      const raw = parsed.rows[idx];
      const humanRow = idx + 2; // header = row 1
      try {
        const mapped = mapImportRow(raw);
        const spec = parseItemsSpec(mapped.itemsSpec);
        const productIds = await this.resolveSkus(storeId, spec);
        await ordersService.create(storeId, {
          customerPhone: mapped.customerPhone,
          items: spec.map(({ sku, quantity }) => ({ productId: productIds.get(sku) as string, quantity })),
          channel: mapped.channel as 'WHATSAPP' | 'DASHBOARD' | 'PAYMENT_LINK',
          discount: mapped.discount ?? undefined,
          deliveryFee: mapped.deliveryFee ?? undefined,
          deliveryAddress: mapped.address ?? undefined,
          deliveryCity: mapped.city ?? undefined,
        });
        created += 1;
      } catch (err) {
        failedRows.push({ row: humanRow, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
    return { created, failedRows };
  }

  private assertUploadable(file: { size: number; mimetype: string }): void {
    if (file.size > IMPORT_MAX_BYTES) throw new ValidationError('CSV file exceeds the 10MB limit');
    const ok =
      /^text\/csv$/i.test(file.mimetype) ||
      /^application\/(vnd\.ms-excel|octet-stream)$/i.test(file.mimetype) ||
      file.mimetype === '';
    if (!ok) throw new ValidationError('Only CSV uploads are supported for orders');
  }

  private async resolveSkus(storeId: string, spec: Array<{ sku: string; quantity: number }>): Promise<Map<string, string>> {
    const skus = Array.from(new Set(spec.map((s) => s.sku)));
    const products = await prisma.product.findMany({
      where: { storeId, sku: { in: skus }, deletedAt: null },
    });
    const bySku = new Map(products.map((p) => [p.sku, p.id]));
    for (const { sku } of spec) {
      if (!bySku.has(sku)) throw new Error(`Unknown SKU "${sku}"`);
    }
    return bySku;
  }

  private async renderItems(orderId: string): Promise<string> {
    const items = await prisma.orderItem.findMany({ where: { orderId } });
    return items.map((i) => `${i.productName} x${i.quantity}`).join('; ');
  }
}

export const orderImportExportService = new OrderImportExportService();
