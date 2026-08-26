import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * DeliveryCostEngine — delivery fee calculation engine.
 *
 * Aggregates rates from providers, applies distance/weight/dimension
 * calculations, surge pricing, and discounts to compute final delivery cost.
 */

export interface CostBreakdown {
  baseFee: number;
  distanceFee: number;
  weightFee: number;
  insuranceFee: number;
  surgeMultiplier: number;
  discount: number;
  totalFee: number;
  currency: string;
  provider: string;
  rateName: string;
  etaMinutes: number | null;
}

export class DeliveryCostEngine {
  constructor(private readonly db: typeof prisma = prisma) {}

  /**
   * Calculate delivery cost for all matching rates across providers.
   */
  async calculate(data: {
    pickupLat?: number;
    pickupLng?: number;
    dropoffLat?: number;
    dropoffLng?: number;
    distanceKm: number;
    weight?: number;
    dimensions?: { length: number; width: number; height: number };
    insuranceAmount?: number;
    carrier?: string;
  }): Promise<CostBreakdown[]> {
    const where: Record<string, unknown> = { isActive: true };
    if (data.carrier) {
      where.provider = { code: data.carrier };
    }

    const rates = await this.db.deliveryRate.findMany({
      where: { isActive: true, ...(data.carrier ? { provider: { code: data.carrier } } : {}) },
      include: { provider: true },
    });

    const breakdowns: CostBreakdown[] = [];

    for (const rate of rates) {
      // Skip if weight/dimensions exceed limits
      if (rate.maxWeightKg && data.weight && data.weight > rate.maxWeightKg) continue;
      if (rate.maxDimensionsCm && data.dimensions) {
        const total = data.dimensions.length + data.dimensions.width + data.dimensions.height;
        if (total > rate.maxDimensionsCm) continue;
      }

      const baseFee = Number(rate.baseFee);
      let distanceFee = data.distanceKm * Number(rate.perKmFee);

      // Free delivery threshold
      if (rate.freeThresholdKm && data.distanceKm <= rate.freeThresholdKm) {
        distanceFee = 0;
      }

      const weightFee = data.weight ? data.weight * Number(rate.perKgFee) : 0;
      const insuranceFee = data.insuranceAmount ? data.insuranceAmount * 0.01 : 0;
      const surgeMultiplier = this.calculateSurgeMultiplier();

      let totalFee = (baseFee + distanceFee + weightFee + insuranceFee) * surgeMultiplier;
      totalFee = Math.max(totalFee, Number(rate.minimumFee));
      if (rate.maximumFee) totalFee = Math.min(totalFee, Number(rate.maximumFee));
      totalFee = Math.round(totalFee * 100) / 100;

      breakdowns.push({
        baseFee,
        distanceFee: Math.round(distanceFee * 100) / 100,
        weightFee: Math.round(weightFee * 100) / 100,
        insuranceFee: Math.round(insuranceFee * 100) / 100,
        surgeMultiplier,
        discount: 0,
        totalFee,
        currency: 'NGN',
        provider: rate.provider.code,
        rateName: rate.name,
        etaMinutes: rate.avgEtaMinutes,
      });
    }

    return breakdowns.sort((a, b) => a.totalFee - b.totalFee);
  }

  /**
   * Calculate surge multiplier based on demand and time of day.
   * Returns 1.0 normally, up to 1.5x during peak hours.
   */
  private calculateSurgeMultiplier(): number {
    const hour = new Date().getUTCHours() + 1; // WAT = UTC+1

    // Peak hours in Lagos: 7-9 AM, 4-7 PM
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) {
      return 1.25;
    }
    // Late night: 10 PM - 6 AM
    if (hour >= 22 || hour < 6) {
      return 1.15;
    }
    return 1.0;
  }

  /**
   * Apply a discount to a cost breakdown.
   */
  applyDiscount(breakdown: CostBreakdown, discountPercent: number): CostBreakdown {
    const discount = breakdown.totalFee * (discountPercent / 100);
    return {
      ...breakdown,
      discount: Math.round(discount * 100) / 100,
      totalFee: Math.round((breakdown.totalFee - discount) * 100) / 100,
    };
  }

  /**
   * Apply a flat discount.
   */
  applyFlatDiscount(breakdown: CostBreakdown, flatAmount: number): CostBreakdown {
    return {
      ...breakdown,
      discount: flatAmount,
      totalFee: Math.max(0, Math.round((breakdown.totalFee - flatAmount) * 100) / 100),
    };
  }
}

export const deliveryCostEngine = new DeliveryCostEngine();
