import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@wco/database';
import { ClaudeService } from '../../services/claude/claude.service';
import { OpenAIService } from '../../services/openai/openai.service';

/**
 * PricingOptimizerService — dynamic pricing suggestions.
 *
 * NOT a black box: every suggestion carries human-readable `reason` and
 * factor breakdown. Merchants approve/dismiss — the AI never silently
 * changes a price. Trust beats cleverness for our market.
 *
 * Heuristic core (v1) + LLM narrative (v1.1):
 *   demandScore  = recentUnitsSold / stockDaysRemaining
 *   competition  = manual merchant input or scraped benchmark (later)
 *   velocity     = 7d vs prior-7d sales trend
 *   marginFloor  = never suggest below costPrice * (1 + minMargin)
 */
@Injectable()
export class PricingOptimizerService {
  private readonly logger = new Logger(PricingOptimizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: ClaudeService,
    private readonly openai: OpenAIService,
  ) {}

  async optimizeStore(storeId: string): Promise<number> {
    const products = await this.prisma.product.findMany({
      where: { storeId, deletedAt: null, status: 'ACTIVE', costPrice: { not: null } },
      select: {
        id: true, name: true, price: true, costPrice: true, stockQuantity: true,
        lowStockThreshold: true,
      },
      take: 200, // bounded batch per run
    });
    if (products.length === 0) return 0;

    const since = new Date(Date.now() - 14 * 24 * 60 * 60_000);
    const sales = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { productId: { in: products.map((p) => p.id) }, order: { createdAt: { gte: since } } },
      _sum: { quantity: true },
    });
    const unitsByProduct = new Map(sales.map((s) => [s.productId, s._sum.quantity ?? 0]));

    let created = 0;
    for (const product of products) {
      const suggestion = await this.suggestFor(storeId, product, unitsByProduct.get(product.id) ?? 0);
      if (!suggestion) continue;
      await this.prisma.priceSuggestion.create({ data: suggestion });
      created++;
    }
    return created;
  }

  private async suggestFor(
    storeId: string,
    product: {
      id: string; name: string; price: unknown; costPrice: unknown;
      stockQuantity: number; lowStockThreshold: number;
    },
    unitsSold14d: number,
  ): Promise<Parameters<typeof this.prisma.priceSuggestion.create>[0]['data'] | null> {
    const currentPrice = Number(product.price);
    const costPrice = Number(product.costPrice);

    // Factor model
    const dailyVelocity = unitsSold14d / 14;
    const stockDaysLeft =
      dailyVelocity > 0 ? product.stockQuantity / dailyVelocity : Number.POSITIVE_INFINITY;
    const marginPct = ((currentPrice - costPrice) / (currentPrice || 1)) * 100;

    let adjustmentPct = 0;
    const factors: string[] = [];

    if (dailyVelocity >= 2 && stockDaysLeft < 7) {
      adjustmentPct += 8; // high demand + thinning stock
      factors.push(`High velocity (${unitsSold14d} units/14d), only ${Math.round(stockDaysLeft)} days of stock left`);
    }
    if (stockDaysLeft > 45 && dailyVelocity > 0) {
      adjustmentPct -= 5; // overstocked — move volume
      factors.push(`Overstocked (~${Math.round(stockDaysLeft)} days of inventory)`);
    }
    if (marginPct < 15) {
      adjustmentPct += 6; // protect thin margins
      factors.push(`Thin margin at ${marginPct.toFixed(1)}%`);
    }
    if (product.stockQuantity === 0) {
      return null; // no point repricing out-of-stock items
    }

    // Clamp to ±15% and enforce margin floor
    adjustmentPct = Math.max(-15, Math.min(15, adjustmentPct));
    const minPrice = costPrice * 1.12; // hard floor: cost + 12%
    let suggested = Math.round(currentPrice * (1 + adjustmentPct / 100));
    if (adjustmentPct < 0 && suggested < minPrice) suggested = Math.ceil(minPrice);
    if (suggested === currentPrice) return null;

    const confidence = Math.min(0.9, 0.4 + factors.length * 0.15);
    const reason =
      (await this.narrate(product.name, currentPrice, suggested, factors)) ??
      `Based on ${factors.join('; ').toLowerCase()}, adjust ${product.name} to ${suggested}.`;

    return {
      storeId,
      productId: product.id,
      currentPrice: String(currentPrice),
      suggestedPrice: String(suggested),
      confidence: String(confidence.toFixed(2)),
      reason,
      factors: Object.fromEntries(factors.map((f, i) => [`factor_${i + 1}`, f])),
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
    } as Parameters<typeof this.prisma.priceSuggestion.create>[0]['data'];
  }

  /** LLM turns the numeric rationale into trader-friendly language. */
  private async narrate(name: string, from: number, to: number, factors: string[]): Promise<string | null> {
    const prompt =
      `Product "${name}" price change ${from} -> ${to}. Reasons: ${factors.join('; ')}. ` +
      `Write ONE short friendly sentence (max 20 words) explaining this to the shop owner. No preamble.`;
    try {
      return await this.claude.complete({ prompt, maxTokens: 64 });
    } catch {
      // Primary unavailable — fall through to secondary
    }
    try {
      return await this.openai.complete({ prompt, maxTokens: 64 });
    } catch (error) {
      this.logger.debug({ err: error }, 'pricing-narrator.degraded');
      return null;
    }
  }
}
