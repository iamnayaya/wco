import type { Prisma } from '@prisma/client';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

function defaultRange(): DateRange {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  return { from, to };
}

function parseRange(dateFrom?: string, dateTo?: string): DateRange {
  if (dateFrom && dateTo) return { from: new Date(dateFrom), to: new Date(dateTo) };
  if (dateFrom) return { from: new Date(dateFrom), to: new Date() };
  if (dateTo) return { from: new Date(Date.now() - 30 * 86_400_000), to: new Date(dateTo) };
  return defaultRange();
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDateTrunc(granularity: string): string {
  switch (granularity) {
    case 'hourly': return 'hour';
    case 'weekly': return 'week';
    case 'monthly': return 'month';
    default: return 'day';
  }
}

/**
 * AnalyticsMetricService — reads aggregated metrics across all business domains.
 *
 * All queries hit existing Prisma models (Order, Customer, OrderItem, etc.)
 * and compute metrics on the fly. In production these would be backed by
 * materialized views or TimescaleDB continuous aggregates, but the interface
 * remains the same.
 */
export class AnalyticsMetricService {
  constructor(private readonly db: typeof prisma = prisma) {}

  // ─── Sales Metrics ──────────────────────────────────────────────

  async calculateSalesMetrics(storeId: string, dateFrom?: string, dateTo?: string): Promise<Record<string, unknown>> {
    const { from, to } = parseRange(dateFrom, dateTo);
    const paidStatuses: Prisma.OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

    const [revenueAgg, totalOrders, avgOrderAgg, previousRevenueAgg, previousOrders] = await Promise.all([
      this.db.order.aggregate({
        where: { storeId, status: { in: paidStatuses }, createdAt: { gte: from, lte: to } },
        _sum: { total: true },
        _count: { id: true },
        _avg: { total: true },
      }),
      this.db.order.count({
        where: { storeId, status: { in: paidStatuses }, createdAt: { gte: from, lte: to } },
      }),
      this.db.order.aggregate({
        where: { storeId, status: { in: paidStatuses }, createdAt: { gte: from, lte: to } },
        _avg: { total: true },
      }),
      // Previous period for growth calculation
      this.db.order.aggregate({
        where: {
          storeId, status: { in: paidStatuses },
          createdAt: { gte: new Date(from.getTime() - (to.getTime() - from.getTime())), lte: from },
        },
        _sum: { total: true },
      }),
      this.db.order.count({
        where: {
          storeId, status: { in: paidStatuses },
          createdAt: { gte: new Date(from.getTime() - (to.getTime() - from.getTime())), lte: from },
        },
      }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.total ?? 0);
    const prevRevenue = Number(previousRevenueAgg._sum.total ?? 0);
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const orderGrowth = previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders) * 100 : 0;

    // Daily revenue series
    const dailyOrders = await this.db.$queryRaw<Array<{ date: Date; revenue: number; orders: number }>>`
      SELECT
        DATE("createdAt") as date,
        SUM("total")::float as revenue,
        COUNT(*)::int as orders
      FROM "orders"
      WHERE "storeId" = ${storeId}
        AND "status" IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
        AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue: Number(avgOrderAgg._avg.total ?? 0),
      revenueGrowth: Math.round(revenueGrowth * 100) / 100,
      orderGrowth: Math.round(orderGrowth * 100) / 100,
      dailySeries: dailyOrders,
      currency: 'NGN',
    };
  }

  // ─── Customer Metrics ───────────────────────────────────────────

  async calculateCustomerMetrics(storeId: string, dateFrom?: string, dateTo?: string): Promise<Record<string, unknown>> {
    const { from, to } = parseRange(dateFrom, dateTo);

    const [totalCustomers, newCustomers, returningCustomers, prevPeriodCustomers] = await Promise.all([
      this.db.customer.count({ where: { storeId } }),
      this.db.customer.count({ where: { storeId, createdAt: { gte: from, lte: to } } }),
      this.db.customer.findMany({
        where: { storeId, createdAt: { lt: from } },
        select: {
          id: true,
          _count: { select: { orders: { where: { createdAt: { gte: from, lte: to } } } } },
        },
      }),
      this.db.customer.count({
        where: { storeId, createdAt: { gte: new Date(from.getTime() - (to.getTime() - from.getTime())), lte: from } },
      }),
    ]);

    const returningCount = returningCustomers.filter((c) => c._count.orders > 0).length;
    const retentionRate = totalCustomers > 0 ? (returningCount / totalCustomers) * 100 : 0;
    const acquisitionRate = prevPeriodCustomers > 0
      ? ((newCustomers - prevPeriodCustomers) / prevPeriodCustomers) * 100
      : 0;

    // Customer lifetime value (average revenue per customer)
    const totalRevenue = await this.db.order.aggregate({
      where: {
        storeId, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
      },
      _sum: { total: true },
    });
    const lifetimeValue = totalCustomers > 0
      ? Number(totalRevenue._sum.total ?? 0) / totalCustomers
      : 0;

    // Cohort analysis — orders per customer
    const orderCounts = await this.db.customer.aggregate({
      where: { storeId, orders: { some: { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } } } },
      _count: { orders: true },
    });

    return {
      totalCustomers,
      newCustomers,
      returningCustomers: returningCount,
      retentionRate: Math.round(retentionRate * 100) / 100,
      acquisitionGrowth: Math.round(acquisitionRate * 100) / 100,
      averageLifetimeValue: Math.round(lifetimeValue * 100) / 100,
      averageOrdersPerCustomer: totalCustomers > 0 ? Math.round((orderCounts._count.orders / totalCustomers) * 100) / 100 : 0,
    };
  }

  // ─── Product Metrics ────────────────────────────────────────────

  async calculateProductMetrics(storeId: string, dateFrom?: string, dateTo?: string): Promise<Record<string, unknown>> {
    const { from, to } = parseRange(dateFrom, dateTo);
    const paidStatuses: Prisma.OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

    const [totalProducts, topSelling, lowPerformers, stockStatus, categories] = await Promise.all([
      this.db.product.count({ where: { storeId, deletedAt: null } }),
      this.db.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: { storeId, status: { in: paidStatuses }, createdAt: { gte: from, lte: to } },
        },
        _sum: { quantity: true, unitPrice: true },
        _count: { id: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      this.db.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: { storeId, status: { in: paidStatuses }, createdAt: { gte: from, lte: to } },
        },
        _sum: { quantity: true, unitPrice: true },
        _count: { id: true },
        orderBy: { _sum: { quantity: 'asc' } },
        take: 10,
      }),
      this.db.product.groupBy({
        by: ['status'],
        where: { storeId, deletedAt: null },
        _count: { id: true },
      }),
      this.db.$queryRaw<Array<{ category: string; products: number; revenue: number }>>`
        SELECT c.name as category, COUNT(DISTINCT p.id)::int as products, COALESCE(SUM(oi."unitPrice" * oi.quantity), 0)::float as revenue
        FROM "products" p
        LEFT JOIN "categories" c ON c.id = p."categoryId"
        LEFT JOIN "order_items" oi ON oi."productId" = p.id
        LEFT JOIN "orders" o ON o.id = oi."orderId" AND o.status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED') AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
        WHERE p."storeId" = ${storeId} AND p."deletedAt" IS NULL
        GROUP BY c.name
        ORDER BY revenue DESC
      `,
    ]);

    // Inventory turnover rate (units sold / avg stock)
    const totalSold = topSelling.reduce((sum, p) => sum + Number(p._sum.quantity ?? 0), 0);
    const avgStock = await this.db.product.aggregate({
      where: { storeId, deletedAt: null, trackStock: true },
      _avg: { stockQuantity: true },
    });
    const avgStockQty = Number(avgStock._avg.stockQuantity ?? 0);
    const inventoryTurnover = avgStockQty > 0 ? totalSold / avgStockQty : 0;

    return {
      totalProducts,
      topSelling: topSelling.map((p) => ({
        productId: p.productId,
        quantitySold: Number(p._sum.quantity ?? 0),
        revenue: Number(p._sum.unitPrice ?? 0),
        orderCount: p._count.id,
      })),
      lowPerformers: lowPerformers.map((p) => ({
        productId: p.productId,
        quantitySold: Number(p._sum.quantity ?? 0),
        revenue: Number(p._sum.unitPrice ?? 0),
        orderCount: p._count.id,
      })),
      inventoryTurnover: Math.round(inventoryTurnover * 100) / 100,
      stockByStatus: stockStatus,
      categoryBreakdown: categories,
    };
  }

  // ─── Message Metrics ────────────────────────────────────────────

  async calculateMessageMetrics(storeId: string, dateFrom?: string, dateTo?: string): Promise<Record<string, unknown>> {
    const { from, to } = parseRange(dateFrom, dateTo);

    const [totalConversations, aiResolved, escalated, avgResponse] = await Promise.all([
      this.db.conversation.count({ where: { storeId, createdAt: { gte: from, lte: to } } }),
      this.db.conversation.count({ where: { storeId, status: 'BOT', createdAt: { gte: from, lte: to } } }),
      this.db.conversation.count({ where: { storeId, status: 'ESCALATED', createdAt: { gte: from, lte: to } } }),
      this.db.dailyStoreMetric.aggregate({
        where: { storeId, date: { gte: from, lte: to } },
        _avg: { avgResponseSeconds: true, aiResolutionRate: true },
      }),
    ]);

    const aiResolutionRate = Number(avgResponse._avg.aiResolutionRate ?? 0);
    const avgResponseSeconds = Number(avgResponse._avg.avgResponseSeconds ?? 0);
    const escalationRate = totalConversations > 0 ? (escalated / totalConversations) * 100 : 0;

    // Daily conversation series
    const dailyConversations = await this.db.$queryRaw<Array<{ date: Date; total: number; ai: number; escalated: number }>>`
      SELECT
        DATE("createdAt") as date,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'BOT')::int as ai,
        COUNT(*) FILTER (WHERE status = 'ESCALATED')::int as escalated
      FROM "conversations"
      WHERE "storeId" = ${storeId}
        AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    return {
      totalConversations,
      aiResolved,
      escalated,
      aiResolutionRate: Math.round(aiResolutionRate * 100) / 100,
      escalationRate: Math.round(escalationRate * 100) / 100,
      avgResponseSeconds: Math.round(avgResponseSeconds),
      dailySeries: dailyConversations,
    };
  }

  // ─── Payment Metrics ────────────────────────────────────────────

  async calculatePaymentMetrics(storeId: string, dateFrom?: string, dateTo?: string): Promise<Record<string, unknown>> {
    const { from, to } = parseRange(dateFrom, dateTo);

    const [total, succeeded, failed, byProvider, byMethod] = await Promise.all([
      this.db.payment.count({ where: { storeId, initializedAt: { gte: from, lte: to } } }),
      this.db.payment.count({ where: { storeId, status: 'SUCCEEDED', paidAt: { gte: from, lte: to } } }),
      this.db.payment.count({ where: { storeId, status: 'FAILED', initializedAt: { gte: from, lte: to } } }),
      this.db.payment.groupBy({
        by: ['provider'],
        where: { storeId, initializedAt: { gte: from, lte: to } },
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.db.paymentMethod.groupBy({
        by: ['type'],
        where: { storeId },
        _count: { id: true },
      }),
    ]);

    const successRate = total > 0 ? (succeeded / total) * 100 : 0;

    // Refund metrics
    const refunds = await this.db.orderRefund.aggregate({
      where: { order: { storeId }, createdAt: { gte: from, lte: to } },
      _count: { id: true },
      _sum: { amount: true },
    });

    // Daily payment series
    const dailyPayments = await this.db.$queryRaw<Array<{ date: Date; total: number; succeeded: number; amount: number }>>`
      SELECT
        DATE("initializedAt") as date,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'SUCCEEDED')::int as succeeded,
        COALESCE(SUM(amount) FILTER (WHERE status = 'SUCCEEDED'), 0)::float as amount
      FROM "payments"
      WHERE "storeId" = ${storeId}
        AND "initializedAt" >= ${from} AND "initializedAt" <= ${to}
      GROUP BY DATE("initializedAt")
      ORDER BY date ASC
    `;

    return {
      totalPayments: total,
      succeeded,
      failed,
      successRate: Math.round(successRate * 100) / 100,
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        count: p._count.id,
        totalAmount: Number(p._sum.amount ?? 0),
      })),
      byMethod: byMethod.map((m) => ({ type: m.type, count: m._count.id })),
      refunds: {
        count: refunds._count.id,
        totalAmount: Number(refunds._sum.amount ?? 0),
      },
      dailySeries: dailyPayments,
    };
  }

  // ─── Delivery Metrics ───────────────────────────────────────────

  async calculateDeliveryMetrics(storeId: string, dateFrom?: string, dateTo?: string): Promise<Record<string, unknown>> {
    const { from, to } = parseRange(dateFrom, dateTo);

    const [total, delivered, failed, byCarrier, claims] = await Promise.all([
      this.db.delivery.count({ where: { storeId, createdAt: { gte: from, lte: to } } }),
      this.db.delivery.count({ where: { storeId, status: 'DELIVERED', deliveredAt: { gte: from, lte: to } } }),
      this.db.delivery.count({ where: { storeId, status: 'FAILED', createdAt: { gte: from, lte: to } } }),
      this.db.delivery.groupBy({
        by: ['carrier'],
        where: { storeId, createdAt: { gte: from, lte: to } },
        _count: { id: true },
        _avg: { etaMinutes: true, rating: true },
      }),
      this.db.deliveryClaim.count({ where: { storeId, createdAt: { gte: from, lte: to } } }),
    ]);

    const successRate = total > 0 ? (delivered / total) * 100 : 0;

    // Average delivery time for completed deliveries
    const avgDelivery = await this.db.delivery.aggregate({
      where: {
        storeId, status: 'DELIVERED',
        pickedUpAt: { not: null }, deliveredAt: { not: null },
        deliveredAt: { gte: from, lte: to },
      },
      _avg: { fee: true, distanceKm: true, rating: true },
    });

    // Daily delivery series
    const dailyDeliveries = await this.db.$queryRaw<Array<{ date: Date; total: number; delivered: number; failed: number }>>`
      SELECT
        DATE("createdAt") as date,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'DELIVERED')::int as delivered,
        COUNT(*) FILTER (WHERE status = 'FAILED')::int as failed
      FROM "deliveries"
      WHERE "storeId" = ${storeId}
        AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    return {
      totalDeliveries: total,
      delivered,
      failed,
      successRate: Math.round(successRate * 100) / 100,
      averageFee: Number(avgDelivery._avg.fee ?? 0),
      averageRating: Number(avgDelivery._avg.rating ?? 0),
      totalClaims: claims,
      byCarrier: byCarrier.map((c) => ({
        carrier: c.carrier,
        count: c._count.id,
        avgEtaMinutes: Number(c._avg.etaMinutes ?? 0),
        avgRating: Number(c._avg.rating ?? 0),
      })),
      dailySeries: dailyDeliveries,
    };
  }

  // ─── Aggregation ────────────────────────────────────────────────

  async aggregateEvents(
    storeId: string,
    eventType: string,
    aggregation: string,
    granularity: string,
    dateFrom?: string,
    dateTo?: string,
    property?: string,
  ): Promise<Array<Record<string, unknown>>> {
    const { from, to } = parseRange(dateFrom, dateTo);
    const trunc = buildDateTrunc(granularity);

    const rows = await this.db.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        DATE_TRUNC(${trunc}, "occurredAt") as bucket,
        ${
          aggregation === 'count'
            ? Prisma.sql`COUNT(*)::int as value`
            : aggregation === 'sum'
              ? Prisma.sql`COALESCE(SUM((${property ?? 'props'})::text::float), 0)::float as value`
              : aggregation === 'avg'
                ? Prisma.sql`COALESCE(AVG((${property ?? 'props'})::text::float), 0)::float as value`
                : aggregation === 'min'
                  ? Prisma.sql`COALESCE(MIN((${property ?? 'props'})::text::float), 0)::float as value`
                  : Prisma.sql`COALESCE(MAX((${property ?? 'props'})::text::float), 0)::float as value`
        }
      FROM "analytics_events"
      WHERE "storeId" = ${storeId}
        AND "type" = ${eventType}
        AND "occurredAt" >= ${from} AND "occurredAt" <= ${to}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    return rows.map((r) => ({
      date: r.bucket,
      value: Number(r.value),
    }));
  }
}

export const analyticsMetricService = new AnalyticsMetricService();
