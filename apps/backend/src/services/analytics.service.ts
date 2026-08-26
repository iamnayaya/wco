import type { AnalyticsEvent } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { ROUTING_KEYS } from '@wco/shared';
import type { DashboardStats } from '@wco/shared';

import { CACHE_KEYS } from '../config/constants.js';
import { prisma } from '../lib/prisma.js';
import { publishDomainEvent } from '../lib/rabbit.js';
import { getRedis } from '../lib/redis.js';

/**
 * Analytics service — behavioral event capture + merchant dashboard reads.
 *
 * Writes are append-only events (hot path, no joins); reads hit the
 * DailyStoreMetric rollups maintained by the maintenance worker. Dashboard
 * responses are cached in Redis for 30s (CACHE_TTL.DASHBOARD_STATS_SECONDS)
 * because every page load of the web app hits this endpoint.
 */
const DASHBOARD_CACHE_TTL = 30;

export interface TrackEventInput {
  readonly storeId: string;
  readonly type: string;
  readonly props?: Record<string, unknown>;
  readonly customerId?: string;
  readonly sessionId?: string;
}

export class AnalyticsService {
  constructor(private readonly db = prisma) {}

  async track(input: TrackEventInput): Promise<void> {
    await this.db.analyticsEvent.create({
      data: {
        storeId: input.storeId,
        type: input.type,
        props: (input.props ?? {}) as Prisma.InputJsonValue,
        customerId: input.customerId,
        sessionId: input.sessionId,
      },
    });
    void publishDomainEvent(ROUTING_KEYS.ANALYTICS_EVENT, { ...input });
  }

  async trackMany(inputs: TrackEventInput[]): Promise<void> {
    if (inputs.length === 0) return;
    await this.db.$transaction(
      inputs.map((input) =>
        this.db.analyticsEvent.create({
          data: {
            storeId: input.storeId,
            type: input.type,
            props: (input.props ?? {}) as Prisma.InputJsonValue,
            customerId: input.customerId,
            sessionId: input.sessionId,
          },
        }),
      ),
    );
  }

  async dashboardStats(storeId: string): Promise<DashboardStats> {
    const redis = getRedis();
    const cacheKey = CACHE_KEYS.DASHBOARD_STATS(storeId, new Date().toISOString().slice(0, 10));
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as DashboardStats;
    } catch {
      // Redis unavailable -> compute live
    }

    const startOfToday = todayStart();
    const [revenueAgg, ordersToday, customersToday, openConversations, aiAgg] = await Promise.all([
      this.db.order.aggregate({
        where: { storeId, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }, createdAt: { gte: startOfToday } },
        _sum: { total: true },
      }),
      this.db.order.count({ where: { storeId, createdAt: { gte: startOfToday } } }),
      this.db.customer.count({ where: { storeId, createdAt: { gte: startOfToday } } }),
      this.db.conversation.count({ where: { storeId, status: { in: ['BOT', 'HANDLED'] } } }),
      this.db.dailyStoreMetric.findUnique({
        where: { storeId_date: { storeId, date: todayStart() } },
        select: { aiResolutionRate: true, avgResponseSeconds: true },
      }),
    ]);

    // AI resolution + response speed come from the nightly rollup; before the
    // first rollup of a new day they read as zero — acceptable for a dashboard
    // that refreshes every 30s.
    const aiResolutionRate = Number(aiAgg?.aiResolutionRate ?? 0);
    const avgResponseSeconds = Number(aiAgg?.avgResponseSeconds ?? 0);

    const stats: DashboardStats = {
      revenueToday: Number(revenueAgg._sum.total ?? 0),
      ordersToday,
      newCustomersToday: customersToday,
      conversationsOpen: openConversations,
      aiResolutionRate,
      avgResponseSeconds,
    };

    try {
      await redis.set(cacheKey, JSON.stringify(stats), 'EX', DASHBOARD_CACHE_TTL);
    } catch {
      // cache write is best-effort
    }
    return stats;
  }

  async dailyMetrics(storeId: string, days = 30): Promise<unknown[]> {
    const since = new Date(Date.now() - days * 86_400_000);
    return this.db.dailyStoreMetric.findMany({
      where: { storeId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });
  }

  /** Top sellers by units + revenue over a window (paid+ orders only). */
  async topProducts(storeId: string, days = 30, limit = 10): Promise<unknown[]> {
    const since = new Date(Date.now() - days * 86_400_000);
    // NOTE: no server-side orderBy here — Prisma's groupBy TS overloads reject
    // ordering by aggregate fields not present in `by`; sorting client-side
    // keeps types honest and the dataset per store is small.
    const groups = await this.db.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { storeId, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }, createdAt: { gte: since } },
      },
      _sum: { quantity: true, unitPrice: true },
      _count: { id: true },
    });
    return groups
      .sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0))
      .slice(0, limit);
  }

  async recentEvents(storeId: string, limit = 50, offset = 0): Promise<AnalyticsEvent[]> {
    return this.db.analyticsEvent.findMany({
      where: { storeId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async countEvents(storeId: string, filters: { type?: string; customerId?: string } = {}): Promise<number> {
    const where: Record<string, unknown> = { storeId };
    if (filters.type) where.type = filters.type;
    if (filters.customerId) where.customerId = filters.customerId;
    return this.db.analyticsEvent.count({ where: where as never });
  }

  async listEvents(
    storeId: string,
    page: number,
    pageSize: number,
    filters: {
      type?: string;
      customerId?: string;
      sessionId?: string;
      dateFrom?: string;
      dateTo?: string;
      sortBy?: string;
      sortOrder?: string;
    } = {},
  ): Promise<AnalyticsEvent[]> {
    const where: Record<string, unknown> = { storeId };
    if (filters.type) where.type = filters.type;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.sessionId) where.sessionId = filters.sessionId;
    if (filters.dateFrom || filters.dateTo) {
      const range: Record<string, Date> = {};
      if (filters.dateFrom) range.gte = new Date(filters.dateFrom);
      if (filters.dateTo) range.lte = new Date(filters.dateTo);
      where.occurredAt = range;
    }

    const orderBy: Record<string, string> = {};
    orderBy[filters.sortBy ?? 'occurredAt'] = filters.sortOrder ?? 'desc';

    return this.db.analyticsEvent.findMany({
      where: where as never,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async countListEvents(storeId: string, filters: {
    type?: string;
    customerId?: string;
    sessionId?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<number> {
    const where: Record<string, unknown> = { storeId };
    if (filters.type) where.type = filters.type;
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.sessionId) where.sessionId = filters.sessionId;
    if (filters.dateFrom || filters.dateTo) {
      const range: Record<string, Date> = {};
      if (filters.dateFrom) range.gte = new Date(filters.dateFrom);
      if (filters.dateTo) range.lte = new Date(filters.dateTo);
      where.occurredAt = range;
    }
    return this.db.analyticsEvent.count({ where: where as never });
  }
}

function todayStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const analyticsService = new AnalyticsService();
