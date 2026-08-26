import { NotFoundError } from '@wco/shared';
import type { Prisma } from '@prisma/client';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * AI Feedback service — captures seller feedback on AI responses,
 * analyzes patterns, and drives continuous prompt improvement.
 */

export class AIFeedbackService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async createFeedback(storeId: string, data: {
    responseId: string;
    type?: string;
    rating?: number;
    comment?: string;
    correction?: string;
    tags?: string[];
  }): Promise<Record<string, unknown>> {
    // Verify response exists
    const response = await this.db.aIResponse.findFirst({
      where: { id: data.responseId, storeId },
    });
    if (!response) throw new NotFoundError('AI response not found');

    const feedback = await this.db.aIFeedback.create({
      data: {
        storeId,
        responseId: data.responseId,
        type: (data.type as never) ?? 'RATING',
        rating: data.rating ?? null,
        comment: data.comment ?? null,
        correction: data.correction ?? null,
        tags: data.tags ?? [],
      },
    });

    // Update prompt metrics if response has a prompt
    if (response.promptId) {
      this.updatePromptMetrics(response.promptId).catch(() => undefined);
    }

    logger.info('ai.feedback.created', {
      storeId,
      responseId: data.responseId,
      type: data.type,
      rating: data.rating,
    });

    return feedback;
  }

  async getFeedbackByResponse(storeId: string, responseId: string): Promise<Record<string, unknown>[]> {
    return this.db.aIFeedback.findMany({
      where: { responseId, storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listFeedback(storeId: string, page = 1, pageSize = 20, filters?: {
    type?: string;
    resolved?: boolean;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Record<string, unknown>[]> {
    const where: Prisma.AIFeedbackWhereInput = { storeId };
    if (filters?.type) where.type = filters.type as never;
    if (filters?.resolved !== undefined) where.resolved = filters.resolved;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    return this.db.aIFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async countFeedback(storeId: string, filters?: Record<string, unknown>): Promise<number> {
    const where: Prisma.AIFeedbackWhereInput = { storeId };
    if (filters?.type) where.type = filters.type as never;
    if (filters?.resolved !== undefined) where.resolved = filters.resolved as boolean;
    return this.db.aIFeedback.count({ where });
  }

  /** Analyze feedback patterns for a store. */
  async analyzeFeedback(storeId: string): Promise<Record<string, unknown>> {
    const [total, byType, avgRating, recentCorrections, unresolvedCount] = await Promise.all([
      this.db.aIFeedback.count({ where: { storeId } }),
      this.db.aIFeedback.groupBy({
        by: ['type'],
        where: { storeId },
        _count: { id: true },
        _avg: { rating: true },
      }),
      this.db.aIFeedback.aggregate({
        where: { storeId, rating: { not: null } },
        _avg: { rating: true },
        _count: { id: true },
      }),
      this.db.aIFeedback.findMany({
        where: { storeId, correction: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { correction: true, comment: true, tags: true, createdAt: true },
      }),
      this.db.aIFeedback.count({ where: { storeId, resolved: false } }),
    ]);

    return {
      totalFeedback: total,
      byType: byType.map((t) => ({ type: t.type, count: t._count.id, avgRating: t._avg.rating })),
      averageRating: avgRating._avg.rating ?? 0,
      ratedCount: avgRating._count.id,
      recentCorrections,
      unresolvedCount,
    };
  }

  /** Mark feedback as resolved. */
  async markResolved(storeId: string, feedbackId: string): Promise<Record<string, unknown>> {
    const feedback = await this.db.aIFeedback.findFirst({
      where: { id: feedbackId, storeId },
    });
    if (!feedback) throw new NotFoundError('Feedback not found');
    return this.db.aIFeedback.update({
      where: { id: feedbackId },
      data: { resolved: true },
    });
  }

  private async updatePromptMetrics(promptId: string): Promise<void> {
    await this.db.$executeRaw`
      UPDATE "ai_prompts"
      SET
        "totalFeedback" = (
          SELECT COUNT(*)::int FROM "ai_feedbacks"
          WHERE "responseId" IN (SELECT "id" FROM "ai_responses" WHERE "promptId" = ${promptId})
        ),
        "avgRating" = COALESCE((
          SELECT AVG("rating")::float FROM "ai_feedbacks"
          WHERE "responseId" IN (SELECT "id" FROM "ai_responses" WHERE "promptId" = ${promptId})
          AND "rating" IS NOT NULL
        ), 0)
      WHERE "id" = ${promptId}
    `;
  }
}

export const aiFeedbackService = new AIFeedbackService();
