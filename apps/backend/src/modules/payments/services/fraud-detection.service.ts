import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * FraudDetectionService — AI-powered payment fraud heuristics.
 *
 * Runs a series of risk checks on every payment attempt and returns a
 * fraud score (0–100). Scores above 50 are flagged for review; above
 * 90 are auto-blocked.
 *
 * Heuristics:
 *   1. Velocity: too many payments in short window
 *   2. Amount anomaly: amount significantly above merchant average
 *   3. Time anomaly: payment at unusual hour for the region
 *   4. Repeat failures: multiple failed payments from same reference pattern
 *   5. First-time high value: large amount from new payment flow
 */

interface FraudCheckResult {
  score: number;
  flagged: boolean;
  blocked: boolean;
  reasons: string[];
}

const VELOCITY_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const VELOCITY_THRESHOLD = 10;
const AMOUNT_ANOMALY_MULTIPLIER = 5;
const HIGH_VALUE_THRESHOLD = 500_000;
const FAILURE_THRESHOLD = 3;
const FAILURE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export class FraudDetectionService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async analyze(storeId: string, data: {
    amount: number;
    currency: string;
    provider: string;
    customerPhone?: string;
    metadata?: Record<string, unknown>;
  }): Promise<FraudCheckResult> {
    const reasons: string[] = [];
    let score = 0;

    // Check 1: Payment velocity
    const velocityResult = await this.checkVelocity(storeId, data.customerPhone);
    if (velocityResult.score > 0) {
      reasons.push(`High payment velocity: ${velocityResult.count} payments in 30 minutes`);
      score += velocityResult.score;
    }

    // Check 2: Amount anomaly
    const amountScore = await this.checkAmountAnomaly(storeId, data.amount);
    if (amountScore > 0) {
      reasons.push(`Amount ${data.amount} is significantly above average`);
      score += amountScore;
    }

    // Check 3: Time anomaly
    const timeScore = this.checkTimeAnomaly();
    if (timeScore > 0) {
      reasons.push('Payment at unusual hour');
      score += timeScore;
    }

    // Check 4: Repeat failures
    const failureResult = await this.checkRepeatFailures(storeId, data.customerPhone);
    if (failureResult.score > 0) {
      reasons.push(`${failureResult.count} recent failed payments`);
      score += failureResult.score;
    }

    // Check 5: High value first-time
    const firstTimeScore = await this.checkFirstTimeHighValue(storeId, data.amount);
    if (firstTimeScore > 0) {
      reasons.push('High-value payment from new flow');
      score += firstTimeScore;
    }

    // Cap score at 100
    score = Math.min(score, 100);

    const result: FraudCheckResult = {
      score,
      flagged: score >= 50,
      blocked: score >= 90,
      reasons,
    };

    if (result.flagged || result.blocked) {
      logger.warn('fraud-detection.flagged', {
        storeId,
        score,
        blocked: result.blocked,
        reasons,
        amount: data.amount,
      });
    }

    return result;
  }

  private async checkVelocity(storeId: string, customerPhone?: string): Promise<{score: number; count: number}> {
    const since = new Date(Date.now() - VELOCITY_WINDOW_MS);
    const where: Record<string, unknown> = { storeId, initializedAt: { gte: since } };
    if (customerPhone) {
      where.order = { customer: { waPhone: customerPhone } };
    }

    const count = await this.db.payment.count({ where: where as never });
    if (count >= VELOCITY_THRESHOLD) return { score: 40, count };
    if (count >= VELOCITY_THRESHOLD / 2) return { score: 20, count };
    return { score: 0, count };
  }

  private async checkAmountAnomaly(storeId: string, amount: number): Promise<number> {
    const avg = await this.db.payment.aggregate({
      where: { storeId, status: 'SUCCEEDED' },
      _avg: { amount: true },
    });

    const avgAmount = Number(avg._avg.amount ?? 0);
    if (avgAmount === 0) return amount > HIGH_VALUE_THRESHOLD ? 25 : 0;

    const ratio = amount / avgAmount;
    if (ratio >= AMOUNT_ANOMALY_MULTIPLIER) return 40;
    if (ratio >= AMOUNT_ANOMALY_MULTIPLIER / 2) return 20;
    return 0;
  }

  private checkTimeAnomaly(): number {
    const hour = new Date().getUTCHours();
    // Payments between 1am–5am WAT (UTC+1) are suspicious
    if (hour >= 0 && hour < 4) return 15;
    return 0;
  }

  private async checkRepeatFailures(storeId: string, customerPhone?: string): Promise<{score: number; count: number}> {
    const since = new Date(Date.now() - FAILURE_WINDOW_MS);
    const where: Record<string, unknown> = {
      storeId,
      status: 'FAILED',
      initializedAt: { gte: since },
    };
    if (customerPhone) {
      where.order = { customer: { waPhone: customerPhone } };
    }

    const count = await this.db.payment.count({ where: where as never });
    if (count >= FAILURE_THRESHOLD) return { score: 30, count };
    if (count >= 2) return { score: 15, count };
    return { score: 0, count };
  }

  private async checkFirstTimeHighValue(storeId: string, amount: number): Promise<number> {
    if (amount < HIGH_VALUE_THRESHOLD) return 0;

    const previousSucceeded = await this.db.payment.count({
      where: { storeId, status: 'SUCCEEDED' },
    });

    if (previousSucceeded === 0) return 25;
    return 0;
  }

  async getFlaggedPayments(
    storeId: string,
    page: number,
    pageSize: number,
  ): Promise<Array<{ id: string; amount: number; provider: string; status: string; createdAt: Date; fraudScore: number | null }>> {
    return this.db.payment.findMany({
      where: { storeId, meta: { path: ['fraudScore'], gte: 50 } },
      select: {
        id: true,
        amount: true,
        provider: true,
        status: true,
        createdAt: true,
        meta: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }).then((rows) =>
      rows.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        provider: r.provider,
        status: r.status,
        createdAt: r.createdAt,
        fraudScore: ((r.meta as Record<string, unknown>)?.fraudScore as number) ?? null,
      })),
    );
  }
}

export const fraudDetectionService = new FraudDetectionService();
