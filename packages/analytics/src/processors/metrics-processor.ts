import { PrismaService } from '@wco/database';

/**
 * MetricsProcessor — drains analytics_events into daily rollups.
 *
 * Runs as a scheduled job (2am store-local time). Reads the raw event
 * stream, aggregates per store/day, upserts DailyStoreMetric rows.
 * Idempotent: safe to re-run for any date window.
 */
export class MetricsProcessor {
  constructor(private readonly prisma: PrismaService) {}

  async processDay(storeId: string, date: Date): Promise<void> {
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

    const [orders, newCustomers, messages] = await Promise.all([
      this.prisma.order.findMany({
        where: { storeId, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }, paidAt: { gte: dayStart, lt: dayEnd } },
        select: { total: true },
      }),
      this.prisma.customer.count({ where: { storeId, createdAt: { gte: dayStart, lt: dayEnd } } }),
      this.prisma.message.count({
        where: { conversation: { storeId }, createdAt: { gte: dayStart, lt: dayEnd } },
      }),
    ]);

    const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);

    const botHandled = await this.prisma.conversation.count({
      where: { storeId, lastMessageAt: { gte: dayStart, lt: dayEnd }, status: 'BOT' },
    });
    const totalConversations = await this.prisma.conversation.count({
      where: { storeId, lastMessageAt: { gte: dayStart, lt: dayEnd } },
    });
    const aiResolutionRate = totalConversations > 0 ? botHandled / totalConversations : 0;

    await this.prisma.dailyStoreMetric.upsert({
      where: { storeId_date: { storeId, date: dayStart } },
      create: {
        storeId,
        date: dayStart,
        revenue,
        ordersCount: orders.length,
        newCustomers,
        messagesCount: messages,
        aiResolutionRate,
      },
      update: {
        revenue,
        ordersCount: orders.length,
        newCustomers,
        messagesCount: messages,
        aiResolutionRate,
      },
    });
  }

  /** Backfill a range — used after outages or when onboarding a store's history. */
  async processRange(storeId: string, fromInclusive: Date, days: number): Promise<number> {
    let processed = 0;
    for (let i = 0; i < days; i++) {
      const date = new Date(fromInclusive);
      date.setDate(date.getDate() + i);
      await this.processDay(storeId, date);
      processed++;
    }
    return processed;
  }
}
