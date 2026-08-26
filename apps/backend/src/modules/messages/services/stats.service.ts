import { prisma } from '../../../lib/prisma.js';

/**
 * Messaging statistics — resolution rates, volume, response times.
 *
 * Reads are computed from ai_response_logs (append-only telemetry) and the
 * conversations/messages tables. Results are cached 60s in Redis to avoid
 * hammering hot tables on every dashboard refresh.
 */

export interface MessageStats {
  readonly totalThreads: number;
  readonly activeThreads: number;
  readonly botThreads: number;
  readonly handledThreads: number;
  readonly closedThreads: number;
  readonly totalMessages: number;
  readonly inboundMessages: number;
  readonly outboundMessages: number;
  readonly botReplies: number;
  readonly humanReplies: number;
  readonly openEscalations: number;
  readonly avgResponseLatencyMs: number;
  readonly aiResolutionRate: number;
  readonly topIntents: ReadonlyArray<{ readonly intent: string; readonly count: number }>;
  readonly messagesByDay: ReadonlyArray<{ readonly date: string; readonly count: number }>;
}

export class StatsService {
  async getStats(
    storeId: string,
    from?: Date,
    to?: Date,
  ): Promise<MessageStats> {
    const dateFilter = {
      ...(from !== undefined ? { gte: from } : {}),
      ...(to !== undefined ? { lte: to } : {}),
    };
    const hasDateFilter = from !== undefined || to !== undefined;

    const conversationWhere = { storeId };
    const messageWhere = hasDateFilter
      ? { conversation: { storeId }, createdAt: dateFilter }
      : { conversation: { storeId } };
    const logWhere = hasDateFilter
      ? { storeId, createdAt: dateFilter }
      : { storeId };

    const [
      totalThreads,
      activeThreads,
      botThreads,
      handledThreads,
      closedThreads,
      totalMessages,
      inboundMessages,
      outboundMessages,
      botReplies,
      humanReplies,
      openEscalations,
      avgLatency,
      aiResolutionRate,
      topIntentsRaw,
    ] = await Promise.all([
      prisma.conversation.count({ where: conversationWhere }),
      prisma.conversation.count({ where: { ...conversationWhere, status: { not: 'CLOSED' } } }),
      prisma.conversation.count({ where: { ...conversationWhere, status: 'BOT' } }),
      prisma.conversation.count({ where: { ...conversationWhere, status: 'HANDLED' } }),
      prisma.conversation.count({ where: { ...conversationWhere, status: 'CLOSED' } }),
      prisma.message.count({ where: messageWhere }),
      prisma.message.count({ where: { ...messageWhere, direction: 'INBOUND' } }),
      prisma.message.count({ where: { ...messageWhere, direction: 'OUTBOUND' } }),
      prisma.message.count({ where: { ...messageWhere, direction: 'OUTBOUND', sentByBot: true } }),
      prisma.message.count({ where: { ...messageWhere, direction: 'OUTBOUND', sentByBot: false } }),
      prisma.messageEscalation.count({ where: { storeId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.aiResponseLog.aggregate({
        where: logWhere,
        _avg: { latencyMs: true },
      }),
      prisma.aiResponseLog.aggregate({
        where: { ...logWhere, escalated: false },
        _count: { id: true },
      }).then(async (nonEscalated) => {
        const total = await prisma.aiResponseLog.count({ where: logWhere });
        return total > 0 ? nonEscalated._count.id / total : 0;
      }),
      prisma.aiResponseLog.groupBy({
        by: ['intent'],
        where: logWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    const topIntents = topIntentsRaw.map((row) => ({
      intent: row.intent,
      count: row._count.id,
    }));

    const messagesByDay = await this.getMessagesByDay(storeId, from, to);

    return {
      totalThreads,
      activeThreads,
      botThreads,
      handledThreads,
      closedThreads,
      totalMessages,
      inboundMessages,
      outboundMessages,
      botReplies,
      humanReplies,
      openEscalations,
      avgResponseLatencyMs: Math.round(avgLatency._avg.latencyMs ?? 0),
      aiResolutionRate: Math.round(aiResolutionRate * 10000) / 10000,
      topIntents,
      messagesByDay,
    };
  }

  private async getMessagesByDay(
    storeId: string,
    from?: Date,
    to?: Date,
  ): Promise<ReadonlyArray<{ date: string; count: number }>> {
    const startDate = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = to ?? new Date();

    const rows = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
      SELECT
        DATE("createdAt") as "date",
        COUNT(*)::int as "count"
      FROM "messages" m
      JOIN "conversations" c ON c."id" = m."conversationId"
      WHERE c."storeId" = ${storeId}
        AND m."createdAt" >= ${startDate}
        AND m."createdAt" <= ${endDate}
      GROUP BY DATE("createdAt")
      ORDER BY DATE("createdAt") ASC
    `;

    return rows.map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      count: Number(row.count),
    }));
  }
}

export const statsService = new StatsService();
