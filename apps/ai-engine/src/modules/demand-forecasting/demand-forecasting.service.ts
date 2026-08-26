import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@wco/database';

/**
 * DemandForecastingService — weekly per-SKU demand forecast.
 *
 * v1: weighted moving average with day-of-week seasonality — explainable,
 * zero infrastructure, and honestly better than an untrained NN on the
 * sparse data most informal traders have. Model version tracked per row so
 * we can A/B upgrade to gradient boosting later.
 */
@Injectable()
export class DemandForecastingService {
  private readonly logger = new Logger(DemandForecastingService.name);
  private static readonly MODEL_VERSION = 'wma-dow-v1';
  private static readonly HORIZON_DAYS = 14;

  constructor(private readonly prisma: PrismaService) {}

  async forecastStore(storeId: string): Promise<number> {
    const products = await this.prisma.product.findMany({
      where: { storeId, deletedAt: null, status: 'ACTIVE', trackStock: true },
      select: { id: true, stockQuantity: true },
      take: 500,
    });

    let written = 0;
    for (const product of products) {
      const history = await this.dailyUnits(storeId, product.id, 56); // 8 weeks
      if (history.length < 14) continue; // not enough signal

      const forecast = this.weightedMovingAverage(history);
      const confidence = this.confidenceFor(history);

      // Upsert horizon days
      for (let dayOffset = 0; dayOffset < DemandForecastingService.HORIZON_DAYS; dayOffset++) {
        const date = new Date();
        date.setUTCHours(0, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() + dayOffset);

        const dow = date.getUTCDay();
        const predictedDemand = Math.max(0, Math.round(forecast.base * forecast.dowFactor[dow]));

        await this.prisma.demandForecast.upsert({
          where: {
            productId_forecastDate: { productId: product.id, forecastDate: date },
          },
          create: {
            storeId,
            productId: product.id,
            forecastDate: date,
            predictedDemand,
            confidence: String(confidence.toFixed(2)),
            modelVersion: DemandForecastingService.MODEL_VERSION,
          },
          update: {
            predictedDemand,
            confidence: String(confidence.toFixed(2)),
            modelVersion: DemandForecastingService.MODEL_VERSION,
          },
        });
      }
      written++;
    }
    return written;
  }

  /** Restock urgency: days of cover vs forecast burn-down. */
  async restockAlerts(storeId: string): Promise<
    Array<{ productId: string; name: string; daysOfCover: number; suggestedOrderQty: number }>
  > {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);

    const forecasts = await this.prisma.demandForecast.findMany({
      where: { storeId, forecastDate: { gte: since }, modelVersion: DemandForecastingService.MODEL_VERSION },
      orderBy: [{ productId: 'asc' }, { forecastDate: 'asc' }],
      include: { product: { select: { id: true, name: true, stockQuantity: true } } },
    });

    const byProduct = new Map<string, typeof forecasts>();
    for (const f of forecasts) {
      const list = byProduct.get(f.productId) ?? [];
      list.push(f);
      byProduct.set(f.productId, list);
    }

    const alerts: Array<{ productId: string; name: string; daysOfCover: number; suggestedOrderQty: number }> = [];
    for (const [productId, rows] of byProduct) {
      const product = rows[0].product;
      const dailyDemand =
        rows.reduce((sum, r) => sum + r.predictedDemand, 0) / (rows.length || 1) || 0;
      if (dailyDemand <= 0) continue;

      const daysOfCover = Math.floor(product.stockQuantity / dailyDemand);
      if (daysOfCover <= 7) {
        // Suggest covering the full 14-day horizon
        const suggestedOrderQty = Math.max(
          0,
          rows.reduce((sum, r) => sum + r.predictedDemand, 0) - product.stockQuantity,
        );
        alerts.push({ productId, name: product.name, daysOfCover, suggestedOrderQty });
      }
    }
    return alerts.sort((a, b) => a.daysOfCover - b.daysOfCover);
  }

  /** Units sold per UTC day over `days` window. */
  private async dailyUnits(storeId: string, productId: string, days: number): Promise<number[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60_000);
    const rows = await this.prisma.$queryRaw<Array<{ day: Date; units: bigint }>>`
      SELECT date_trunc('day', o.created_at)::date AS day, SUM(oi.quantity) AS units
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.product_id = ${productId}
        AND o.store_id = ${storeId}
        AND o.created_at >= ${since}
        AND o.status NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY 1 ORDER BY 1 ASC
    `;

    // Dense array including zero-sale days — seasonality needs the zeros
    const map = new Map(rows.map((r) => [new Date(r.day).toISOString().slice(0, 10), Number(r.units)]));
    const series: number[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60_000).toISOString().slice(0, 10);
      series.push(map.get(d) ?? 0);
    }
    return series;
  }

  private weightedMovingAverage(series: number[]): {
    base: number;
    dowFactor: number[];
  } {
    // Recent weeks weigh more (recency bias)
    const weeks = Math.min(4, Math.floor(series.length / 7));
    let weightSum = 0;
    let weightedTotal = 0;
    for (let w = 1; w <= weeks; w++) {
      const weekSlice = series.slice(-(w * 7), series.length - (w - 1) * 7);
      const weekAvg = weekSlice.reduce((s, v) => s + v, 0) / 7;
      const weight = w; // older weeks get lower weight
      weightedTotal += weekAvg * weight;
      weightSum += weight;
    }
    const base = weightSum > 0 ? weightedTotal / weightSum : 0;

    // Day-of-week multipliers from last 28 days
    const dowTotals = Array.from({ length: 7 }, () => 0);
    const dowCounts = Array.from({ length: 7 }, () => 0);
    const recent = series.slice(-28);
    recent.forEach((v, idx) => {
      const dow = new Date(Date.now() - (recent.length - 1 - idx) * 24 * 60 * 60_000).getUTCDay();
      dowTotals[dow] += v;
      dowCounts[dow] += 1;
    });
    const overallAvg = recent.reduce((s, v) => s + v, 0) / (recent.length || 1);
    const dowFactor = dowTotals.map((total, i) =>
      overallAvg > 0 && dowCounts[i] > 0 ? Math.min(2.5, Math.max(0.3, total / dowCounts[i] / overallAvg)) : 1,
    );

    return { base, dowFactor };
  }

  /** Coefficient-of-variation based confidence — noisy series → low trust. */
  private confidenceFor(series: number[]): number {
    const mean = series.reduce((s, v) => s + v, 0) / series.length;
    if (mean === 0) return 0.1;
    const variance = series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length;
    const cv = Math.sqrt(variance) / mean; // coefficient of variation
    return Math.max(0.15, Math.min(0.85, 1 - cv));
  }
}
