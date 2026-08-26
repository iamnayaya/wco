import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { ClaudeService } from '../../services/claude/claude.service';
import { OpenAIService } from '../../services/openai/openai.service';

/**
 * CustomerSegmentationService — nightly RFM-style segmentation.
 *
 * Segments (stored on Customer.segment):
 *   VIP        — top 10% spenders with recent activity
 *   REPEAT     — 2+ orders, active in last 30d
 *   NEW        — first order within last 14 days
 *   CHURN_RISK — historically active, silent 21+ days
 *
 * Rules-based core (auditable) with an LLM pass that writes a one-line
 * "what to do about it" coaching note per segment for the dashboard.
 */
@Injectable()
export class CustomerSegmentationService {
  private readonly logger = new Logger(CustomerSegmentationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
    private readonly openai: OpenAIService,
  ) {}

  async segmentStore(storeId: string): Promise<number> {
    const customers = await this.prisma.customer.findMany({
      where: { storeId },
      select: {
        id: true, totalSpent: true, ordersCount: true,
        lastOrderAt: true, createdAt: true,
      },
      take: 5000,
    });

    // VIP threshold = top decile of spend
    const sortedSpend = [...customers].sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent));
    const vipCutoffIndex = Math.max(0, Math.floor(sortedSpend.length * 0.1) - 1);
    const vipThreshold = Number(sortedSpend[vipCutoffIndex]?.totalSpent ?? Infinity);

    const now = Date.now();
    let updated = 0;

    for (const c of customers) {
      const daysSinceLastOrder = c.lastOrderAt
        ? (now - c.lastOrderAt.getTime()) / 86_400_000
        : (now - c.createdAt.getTime()) / 86_400_000;
      const daysSinceFirst = (now - c.createdAt.getTime()) / 86_400_000;

      let segment: string;
      if (Number(c.totalSpent) >= vipThreshold && daysSinceLastOrder <= 30 && c.ordersCount >= 2) {
        segment = 'VIP';
      } else if (c.ordersCount === 1 && daysSinceFirst <= 14) {
        segment = 'NEW';
      } else if (daysSinceLastOrder > 21 && c.ordersCount >= 2) {
        segment = 'CHURN_RISK';
      } else if (c.ordersCount >= 2) {
        segment = 'REPEAT';
      } else {
        continue; // one-off old buyers stay unsegmented until they re-engage
      }

      await this.prisma.customer.update({
        where: { id: c.id },
        data: { segment },
      });
      updated++;
    }
    return updated;
  }

  /** Coaching copy per segment shown on the Customers page. */
  async segmentCoaching(segment: string): Promise<string> {
    const prompt =
      `WhatsApp commerce. Segment "${segment}". ` +
      `Write ONE actionable tip (max 25 words) for the shop owner to grow this segment. No preamble.`;
    try {
      return await this.claude.complete({ prompt, maxTokens: 80 });
    } catch {
      try {
        return await this.openai.complete({ prompt, maxTokens: 80 });
      } catch (error) {
        this.logger.debug({ err: error }, 'coaching.degraded');
        return 'Send a friendly check-in message with one product recommendation.';
      }
    }
  }
}
