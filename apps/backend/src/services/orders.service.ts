import type { Order, OrderItem, OrderStatus, Prisma } from '@prisma/client';
import { ConflictError, InsufficientStockError, NotFoundError, ValidationError } from '@wco/shared';
import { ORDER_STATUSES, ORDER_TRANSITIONS } from '@wco/shared';

import { prisma } from '../lib/prisma.js';
import type { ListOrdersV2Query } from '../modules/orders/orders.dto.js';
import { generateOrderNumber } from '../utils/order-number.js';
import { decodeCursor, encodeCursor } from '../utils/pagination.js';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Orders service — the money path.
 *
 * Invariants enforced here:
 *  1. Prices come from the DB, never the client (catalog is the source of truth).
 *  2. Stock decrements are CONDITIONAL updates inside the order transaction —
 *     two concurrent buyers racing the last unit yields exactly one winner,
 *     the loser gets a clean 409 INSUFFICIENT_STOCK.
 *  3. Status moves follow the ORDER_TRANSITIONS state machine (@wco/shared).
 *  4. Every meaningful transition appends an OutboxEvent so downstream systems
 *     (AI engine, campaigns, merchant webhooks) react without coupling.
 */

export interface OrderItemInput {
  readonly productId: string;
  readonly variantId?: string;
  readonly quantity: number;
  readonly note?: string;
}

export interface CreateOrderInput {
  readonly items: readonly OrderItemInput[];
  readonly customerId?: string;
  readonly customerPhone?: string;
  readonly channel?: 'WHATSAPP' | 'DASHBOARD' | 'PAYMENT_LINK';
  readonly discount?: number;
  readonly deliveryFee?: number;
  readonly notes?: string;
  readonly deliveryAddress?: string;
  readonly deliveryCity?: string;
}

export class OrdersService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async create(storeId: string, input: CreateOrderInput): Promise<Order & { items: OrderItem[] }> {
    if (input.items.length === 0) throw new ValidationError('Order must contain at least one item');
    if ((input.discount ?? 0) < 0 || (input.deliveryFee ?? 0) < 0) {
      throw new ValidationError('Discount and delivery fee cannot be negative');
    }

    // Resolve customer up-front (outside the stock transaction — cheap lookup).
    const customerId = await this.resolveCustomerId(this.db, storeId, input);

    // Retry loop absorbs the rare orderNumber unique-collision.
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition, @typescript-eslint/no-unnecessary-condition
    while (true) {
      attempt += 1;
      try {
        return await this.db.$transaction((tx) =>
          this.createWithinTransaction(tx as unknown as Prisma.TransactionClient, storeId, customerId, input),
        );
      } catch (err) {
        if (err instanceof InsufficientStockError || err instanceof ValidationError) throw err;
        const code = (err as { code?: string }).code;
        if (code === 'P2002' && attempt < 3) continue; // orderNumber clash — regenerate & retry
        throw err;
      }
    }
  }

  private async createWithinTransaction(
    tx: Prisma.TransactionClient,
    storeId: string,
    customerId: string,
    input: CreateOrderInput,
  ): Promise<Order & { items: OrderItem[] }> {
    // --- Load catalog rows & build snapshots ---------------------------------
    const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, storeId, deletedAt: null },
      include: { variants: true },
    });
    if (products.length !== productIds.length) throw new NotFoundError('One or more products');

    const lines = input.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) throw new NotFoundError(`Product ${item.productId}`);
      if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        throw new ValidationError(`Invalid quantity for ${product.name}`);
      }
      const variant = item.variantId ? product.variants.find((v) => v.id === item.variantId) : null;
      if (item.variantId && !variant) throw new NotFoundError(`Variant ${item.variantId}`);

      const unitPrice = variant?.price ?? product.price;
      return { item, product, variant, unitPrice };
    });

    // --- Conditional stock decrement (oversell guard) -------------------------
    for (const line of lines) {
      if (!line.product.trackStock) continue;
      await this.decrementStock(tx, line);
    }

    // --- Money -----------------------------------------------------------------
    const subtotal = lines.reduce((sum, l) => sum + Number(l.unitPrice) * l.item.quantity, 0);
    const discount = input.discount ?? 0;
    const deliveryFee = input.deliveryFee ?? 0;
    const total = Math.max(0, subtotal - discount + deliveryFee);
    if (discount > subtotal) throw new ValidationError('Discount exceeds order subtotal');

    // --- Persist ---------------------------------------------------------------
    const order = await tx.order.create({
      data: {
        storeId,
        customerId,
        orderNumber: generateOrderNumber(),
        status: 'PENDING_PAYMENT',
        channel: input.channel ?? 'DASHBOARD',
        subtotal,
        discount,
        deliveryFee,
        total,
        currency: 'NGN', // store currency default; multi-currency lands with PSP split
        notes: input.notes,
        deliveryAddress: input.deliveryAddress,
        deliveryCity: input.deliveryCity,
        items: {
          create: lines.map(({ item, product, variant, unitPrice }) => ({
            productId: product.id,
            variantId: variant?.id,
            productName: product.name,
            variantName: variant?.name,
            sku: variant?.sku ?? product.sku,
            quantity: item.quantity,
            unitPrice,
            note: item.note,
          })),
        },
      },
      include: { items: true },
    });

    await this.emitDomainEvent(tx, storeId, 'order.created', order.id, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total,
    });
    return order;
  }

  /** Atomic guarded decrement across product or variant rows. */
  private async decrementStock(
    tx: Prisma.TransactionClient,
    line: { item: OrderItemInput; product: { id: string; name: string }; variant?: { id: string } | null },
  ): Promise<void> {
    const qty = line.item.quantity;

    if (line.variant) {
      const hit = await tx.productVariant.updateMany({
        where: { id: line.variant.id, stockQuantity: { gte: qty }, trackStock: true },
        data: { stockQuantity: { decrement: qty } },
      });
      if (hit.count === 0) throw new InsufficientStockError(line.product.name);
      // Mirror summed variant stock onto the parent for fast list reads.
      const agg = await tx.productVariant.aggregate({
        where: { productId: line.product.id, trackStock: true },
        _sum: { stockQuantity: true },
      });
      const nextParent = agg._sum.stockQuantity ?? 0;
      await tx.product.updateMany({
        where: { id: line.product.id, trackStock: true },
        data: { stockQuantity: nextParent, ...(nextParent === 0 ? { status: 'OUT_OF_STOCK' } : {}) },
      });
      return;
    }

    const hit = await tx.product.updateMany({
      where: { id: line.product.id, stockQuantity: { gte: qty }, trackStock: true },
      data: { stockQuantity: { decrement: qty } },
    });
    if (hit.count === 0) throw new InsufficientStockError(line.product.name);
    await tx.product.updateMany({
      where: { id: line.product.id, stockQuantity: 0, trackStock: true },
      data: { status: 'OUT_OF_STOCK' },
    });
  }

  private static assertTransitionLegal(from: OrderStatus, to: OrderStatus): void {
    const allowed = ORDER_TRANSITIONS[from];
    if (!allowed.includes(to)) throw new ConflictError(`Illegal transition ${from} -> ${to}`);
  }

  /** Offline rails (cash/bank) can be confirmed manually; a FAILED PSP payment cannot. */
  private static assertPaidAllowed(payment: { provider: string; status: string } | undefined | null): void {
    if (!payment) return;
    const offline = payment.provider === 'CASH' || payment.provider === 'BANK_TRANSFER';
    if (payment.status === 'FAILED' && !offline) {
      throw new ConflictError('Payment failed - confirm a valid payment before marking PAID');
    }
  }

  /** Status + lifecycle timestamps for one hop of the machine. */
  private static statusPatch(to: OrderStatus, now: Date, reason?: string): Prisma.OrderUpdateInput {
    switch (to) {
      case 'PAID':
        return { status: to, paidAt: now };
      case 'SHIPPED':
        return { status: to, shippedAt: now };
      case 'DELIVERED':
        return { status: to, deliveredAt: now };
      case 'CANCELLED':
        return { status: to, cancelledAt: now, cancellationReason: reason ?? 'Cancelled by merchant' };
      default:
        return { status: to };
    }
  }

  /**
   * State machine transition. Callers pass the TARGET status; legal moves are
   * validated against ORDER_TRANSITIONS. Timestamps applied automatically,
   * every move appends OrderStatusHistory (audit trail), and PAID is refused
   * when the linked PSP payment explicitly FAILED.
   */
  async transition(
    storeId: string,
    orderId: string,
    to: OrderStatus,
    reason?: string,
    actorId?: string | null,
  ): Promise<Order> {
    const result = await this.db.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, storeId } });
      if (!order) throw new NotFoundError('Order');

      if (order.status === to) return order; // idempotent no-op

      OrdersService.assertTransitionLegal(order.status, to);

      if (to === 'PAID') {
        const paymentRows = await tx.payment.findMany({ where: { orderId }, take: 1 });
        OrdersService.assertPaidAllowed(paymentRows.at(0));
      }

      const now = new Date();
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          ...OrdersService.statusPatch(to, now, reason),
          ...(to === 'REFUNDED' ? { paymentReference: order.paymentReference } : {}),
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: to,
          reason: reason ?? null,
          actorId: actorId ?? null,
        },
      });

      await this.emitDomainEvent(tx, storeId, `order.${EVENT_SUFFIX[to]}`, order.id, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        from: order.status,
        to,
        reason,
      });
      return updated;
    });
    return result;
  }

  async list(
    storeId: string,
    query: {
      status?: OrderStatus;
      q?: string;
      limit: number;
      cursor?: string;
      customerId?: string;
      createdAfter?: Date;
    },
  ): Promise<{ items: Order[]; nextCursor: string | null }> {
    const where: Prisma.OrderWhereInput = {
      storeId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.createdAfter ? { createdAt: { gte: query.createdAfter } } : {}),
      ...(query.q
        ? {
            OR: [
              { orderNumber: { contains: query.q.toUpperCase() } },
              { customer: { waPhone: { contains: query.q.replace(/[^\d]/g, '') } } },
              { customer: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(query.cursor ? { id: { gt: decodeCursor(query.cursor) } } : {}),
    };
    const items = await this.db.order.findMany({
      where,
      orderBy: { id: 'asc' },
      take: query.limit,
      include: { customer: { select: { id: true, name: true, waPhone: true } }, _count: { select: { items: true } } },
    });
    return {
      items,
      nextCursor: items.length === query.limit && items.length > 0
        ? encodeCursor(items[items.length - 1].id)
        : null,
    };
  }

  async get(storeId: string, orderId: string): Promise<Order & { items: OrderItem[] }> {
    const order = await this.db.order.findFirst({
      where: { id: orderId, storeId },
      include: { items: true },
    });
    if (!order) throw new NotFoundError('Order');
    return order;
  }

  /** Post-creation edits - logistics/context fields only, never money lines. */
  async update(
    storeId: string,
    orderId: string,
    patch: { notes?: string; deliveryAddress?: string | null; deliveryCity?: string | null },
  ): Promise<Order> {
    const rows = await this.db.order.findMany({ where: { id: orderId, storeId }, take: 1 });
    const order = rows.at(0);
    if (!order) throw new NotFoundError('Order');
    return this.db.order.update({ where: { id: order.id }, data: patch });
  }

  /** Buyer contact for post-transition notifications (null when deleted). */
  async getCustomerContact(storeId: string, orderId: string): Promise<{ name: string; waPhone: string } | null> {
    const rows = await this.db.order.findMany({ where: { id: orderId, storeId }, take: 1 });
    const order = rows.at(0);
    if (!order) return null;
    const customerRows = await this.db.customer.findMany({ where: { id: order.customerId }, take: 1 });
    const customer = customerRows.at(0);
    return customer ? { name: customer.name ?? 'Customer', waPhone: customer.waPhone } : null;
  }

  /**
   * v2 offset listing - SQL filters for everything index-backed, one JS pass
   * for the cross-table `q` search (order number / customer name / phone).
   * Returns pagination-ready `{items,total}` and decorates rows with their
   * customer snapshot.
   */
  async listV2(
    storeId: string,
    query: ListOrdersV2Query,
  ): Promise<{ items: Array<Order & { customer: { id: string; name: string | null; waPhone: string } | null }>; total: number }> {
    const where = this.buildWhere(storeId, query);
    const all = await this.db.order.findMany({
      where,
      orderBy: [{ [query.sortBy]: query.sortOrder }],
    });
    const customers = await this.loadCustomerMap(storeId);

    let filtered = all;
    if (query.q) {
      filtered = filtered.filter((o) => this.matchesQ(o, customers.get(o.customerId), query.q as string));
    }
    const start = (query.page - 1) * query.pageSize;
    const page = filtered.slice(start, start + query.pageSize).map((o) => ({
      ...o,
      customer: customers.get(o.customerId) ?? null,
    }));
    return { items: page, total: filtered.length };
  }

  /** Shared WHERE builder (list + export). Index-backed predicates only. */
  buildWhere(
    storeId: string,
    query: Pick<
      ListOrdersV2Query,
      'status' | 'channel' | 'customerId' | 'minTotal' | 'maxTotal' | 'dateFrom' | 'dateTo'
    >,
  ): Prisma.OrderWhereInput {
    return {
      storeId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.minTotal !== undefined || query.maxTotal !== undefined
        ? {
            total: {
              ...(query.minTotal !== undefined ? { gte: query.minTotal } : {}),
              ...(query.maxTotal !== undefined ? { lte: query.maxTotal } : {}),
            },
          }
        : {}),
      ...(query.dateFrom !== undefined || query.dateTo !== undefined
        ? {
            createdAt: {
              ...(query.dateFrom !== undefined ? { gte: query.dateFrom } : {}),
              ...(query.dateTo !== undefined ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    };
  }

  private matchesQ(
    order: Order,
    customer: { name: string | null; waPhone: string } | undefined,
    q: string,
  ): boolean {
    if (order.orderNumber.toUpperCase().includes(q.toUpperCase())) return true;
    if (!customer) return false;
    if (customer.name && customer.name.toLowerCase().includes(q.toLowerCase())) return true;
    const digits = q.replace(/\D/g, '');
    return digits.length >= 4 && customer.waPhone.includes(digits);
  }

  private async loadCustomerMap(
    storeId: string,
  ): Promise<Map<string, { id: string; name: string | null; waPhone: string }>> {
    const customers = await this.db.customer.findMany({ where: { storeId } });
    return new Map(customers.map((c) => [c.id, { id: c.id, name: c.name ?? null, waPhone: c.waPhone }]));
  }

  /** Catalog rollup for the dashboard header cards. */
  async stats(storeId: string): Promise<{
    total: number;
    byStatus: Record<OrderStatus, number>;
    revenue: number;
    avgOrderValue: number;
    todayCount: number;
    fulfilmentRate: number;
    cancelRate: number;
  }> {
    const orders = await this.db.order.findMany({ where: { storeId } });
    const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
    let revenue = 0;
    let delivered = 0;
    let cancelled = 0;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (const order of orders) {
      byStatus[order.status] += 1;
      if (order.status !== 'CANCELLED' && order.status !== 'REFUNDED') revenue += Number(order.total);
      if (order.status === 'DELIVERED') delivered += 1;
      if (order.status === 'CANCELLED') cancelled += 1;
    }
    const completed = delivered + cancelled;
    const billable = orders.length - byStatus.CANCELLED - byStatus.REFUNDED;
    return {
      total: orders.length,
      byStatus,
      revenue: round2(revenue),
      avgOrderValue: billable > 0 ? round2(revenue / billable) : 0,
      todayCount: orders.filter((o) => o.createdAt >= startOfToday).length,
      fulfilmentRate: completed > 0 ? round2((delivered / completed) * 100) : 0,
      cancelRate: orders.length > 0 ? round2((cancelled / orders.length) * 100) : 0,
    };
  }

  async cancel(storeId: string, orderId: string, reason?: string): Promise<Order> {
    const cancelled = await this.transition(storeId, orderId, 'CANCELLED', reason);
    // Return reserved stock (only for orders that had decremented it).
    await this.restoreStock(cancelled.id);
    return cancelled;
  }

  private async restoreStock(orderId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: { orderId, variantId: null },
        include: { product: true },
      });
      for (const item of items) {
        if (!item.product.trackStock) continue;
        await tx.product.updateMany({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity }, status: 'ACTIVE' },
        });
      }
    });
  }

  private async resolveCustomerId(
    db: typeof prisma,
    storeId: string,
    input: CreateOrderInput,
  ): Promise<string> {
    if (input.customerId) {
      const found = await db.customer.findFirst({ where: { id: input.customerId, storeId }, select: { id: true } });
      if (!found) throw new NotFoundError('Customer');
      return found.id;
    }
    if (!input.customerPhone) throw new ValidationError('customerId or customerPhone is required');
    const { customersService } = await import('./customers.service.js');
    const customer = await customersService.upsertByPhone(storeId, input.customerPhone);
    return customer.id;
  }

  private async emitDomainEvent(
    tx: Pick<Prisma.TransactionClient, 'outboxEvent'>,
    storeId: string,
    eventType: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: 'order',
        aggregateId,
        eventType,
        payload: { ...payload, storeId },
      },
    });
  }
}

const EVENT_SUFFIX: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

export const ordersService = new OrdersService();
