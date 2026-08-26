import { Injectable } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { TenantContext } from '../../common/context/tenant-context';

const CACHE_TTL_SECONDS = 60;

/**
 * AnalyticsService — merchant dashboard reads.
 *
 * OLAP-style reads hit DailyStoreMetric ROLLUPS (not raw tables) so a
 * merchant with 500K orders renders as fast as one with five. Redis caches
 * each dashboard payload for 60s — dashboards are read-heavy and
 * minute-fresh is more than enough for traders.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async summary() {
    const { storeId } = TenantContext.require();
    const cacheKey = `dash:${storeId}:summary`;

    const cached = await this.redis.getJson<unknown>(cacheKey);
    if (cached) return cached;

    const [today, yesterday, last7] = await Promise.all([
      this.metricForDate(storeId, startOfToday()),
      this.metricForDate(storeId, addDays(startOfToday(), -1)),
      this.timeseries(storeId, 7),
    ]);

    const payload = {
      today: {
        revenue: Number(today?.revenue ?? 0),
        orders: today?.ordersCount ?? 0,
        newCustomers: today?.newCustomers ?? 0,
        messages: today?.messagesCount ?? 0,
      },
      vsYesterday: {
        revenueDeltaPct: pctChange(Number(yesterday?.revenue ?? 0), Number(today?.revenue ?? 0)),
        ordersDeltaPct: pctChange(yesterday?.ordersCount ?? 0, today?.ordersCount ?? 0),
      },
      week: {
        revenue: last7.reduce((sum, d) => sum + Number(d.revenue), 0),
        orders: last7.reduce((sum, d) => sum + d.ordersCount, 0),
        aiResolutionRate:
          last7.length > 0
            ? last7.reduce((s, d) => s + Number(d.aiResolutionRate), 0) / last7.length
            : 0,
      },
      timeseries: last7.map((d) => ({
        date: d.date.toISOString().slice(0, 10),
        revenue: Number(d.revenue),
        orders: d.ordersCount,
      })),
    };

    await this.redis.setJson(cacheKey, payload, CACHE_TTL_SECONDS);
    return payload;
  }

  async topProducts(days = 30) {
    const { storeId } = TenantContext.require();
    const since = addDays(new Date(), -days);

    // Raw aggregation over order_items joined through tenant-scoped orders.
    return this.prisma.$queryRaw<
      Array<{ productId: string; name: string; unitsSold: number; revenue: number }>
    >`
      SELECT oi.product_id AS "productId",
             oi.product_name AS name,
             SUM(oi.quantity)::int AS "unitsSold",
             SUM(oi.quantity * oi.unit_price) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = ${storeId}
        AND o.created_at >= ${since}
        AND o.status NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY oi.product_id, oi.product_name
      ORDER BY revenue DESC
      LIMIT 10
    `;
  }

  async conversionFunnel(days = 30) {
    const { storeId } = TenantContext.require();
    const since = addDays(new Date(), -days);

    const [conversations, orders, paid] = await Promise.all([
      this.prisma.conversation.count({ where: { storeId, createdAt: { gte: since } } }),
      this.prisma.order.count({ where: { storeId, createdAt: { gte: since } } }),
      this.prisma.order.count({
        where: { storeId, createdAt: { gte: since }, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      }),
    ]);

    return {
      conversations,
      ordersCreated: orders,
      ordersPaid: paid,
      chatToOrderRate: conversations > 0 ? round2(orders / conversations) : 0,
      checkoutCompletion: orders > 0 ? round2(paid / orders) : 0,
    };
  }

  private async metricForDate(storeId: string, date: Date) {
    return this.prisma.dailyStoreMetric.findUnique({
      where: { storeId_date: { storeId, date } },
    });
  }

  private async timeseries(storeId: string, days: number) {
    return this.prisma.dailyStoreMetric.findMany({
      where: { storeId, date: { gte: addDays(startOfToday(), -(days - 1)) } },
      orderBy: { date: 'asc' },
    });
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function pctChange(before: number, after: number): number | null {
  if (before === 0) return after > 0 ? 100 : null;
  return round2(((after - before) / before) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
