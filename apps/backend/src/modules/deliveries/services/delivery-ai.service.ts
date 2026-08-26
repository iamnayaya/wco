import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * DeliveryAiService — AI-powered delivery intelligence.
 *
 * Provides:
 * - Delivery time prediction based on historical data and heuristics
 * - Optimal delivery provider suggestions based on cost, speed, reliability
 * - Route optimization for batch deliveries
 */

export interface DeliveryTimePrediction {
  estimatedMinutes: number;
  confidence: number; // 0-1
  factors: string[];
}

export interface ProviderSuggestion {
  carrier: string;
  score: number; // 0-100
  estimatedFee: number;
  estimatedMinutes: number;
  reliability: number; // historical success rate
  reasons: string[];
}

export interface RouteOptimization {
  optimizedOrder: string[]; // delivery IDs in optimal order
  totalDistanceKm: number;
  estimatedTotalMinutes: number;
  savings: { distanceKm: number; minutes: number };
}

export class DeliveryAiService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /**
   * Predict delivery time based on historical data, distance, and conditions.
   */
  async predictDeliveryTime(data: {
    pickupLat?: number;
    pickupLng?: number;
    dropoffLat?: number;
    dropoffLng?: number;
    distanceKm: number;
    carrier?: string;
    timeOfDay?: Date;
  }): Promise<DeliveryTimePrediction> {
    const factors: string[] = [];
    let baseMinutes = data.distanceKm * 3; // 3 min/km baseline for city delivery

    // Time-of-day adjustment
    const hour = (data.timeOfDay ?? new Date()).getUTCHours() + 1;
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) {
      baseMinutes *= 1.4;
      factors.push('Peak traffic hours (+40%)');
    } else if (hour >= 22 || hour < 6) {
      baseMinutes *= 0.8;
      factors.push('Off-peak hours (-20%)');
    }

    // Day-of-week adjustment
    const day = (data.timeOfDay ?? new Date()).getDay();
    if (day === 0 || day === 6) {
      baseMinutes *= 0.85;
      factors.push('Weekend (faster)');
    }

    // Historical performance for this carrier
    if (data.carrier) {
      const historical = await this.getCarrierPerformance(data.carrier);
      if (historical) {
        const adjustment = historical.avgDeliveryMinutes / (data.distanceKm * 3);
        baseMinutes *= adjustment;
        factors.push(`Historical ${data.carrier} performance: ${(adjustment * 100 - 100).toFixed(0)}%`);
      }
    }

    // Distance-based adjustment for long distances
    if (data.distanceKm > 30) {
      baseMinutes *= 1.2;
      factors.push('Long distance (+20%)');
    }

    const estimatedMinutes = Math.round(baseMinutes);
    const confidence = Math.min(0.95, Math.max(0.3, 1 - factors.length * 0.1));

    return { estimatedMinutes, confidence, factors };
  }

  /**
   * Suggest optimal delivery providers based on cost, speed, and reliability.
   */
  async suggestProviders(data: {
    distanceKm: number;
    weight?: number;
    dimensions?: { length: number; width: number; height: number };
    priority?: 'cheapest' | 'fastest' | 'best';
  }): Promise<ProviderSuggestion[]> {
    const rates = await this.db.deliveryRate.findMany({
      where: { isActive: true },
      include: { provider: true },
    });

    const suggestions: ProviderSuggestion[] = [];

    for (const rate of rates) {
      if (!rate.provider.isActive) continue;
      if (rate.maxWeightKg && data.weight && data.weight > rate.maxWeightKg) continue;
      if (rate.maxDimensionsCm && data.dimensions) {
        const total = data.dimensions.length + data.dimensions.width + data.dimensions.height;
        if (total > rate.maxDimensionsCm) continue;
      }

      let fee = Number(rate.baseFee) + data.distanceKm * Number(rate.perKmFee);
      if (data.weight) fee += data.weight * Number(rate.perKgFee);
      fee = Math.max(fee, Number(rate.minimumFee));
      if (rate.maximumFee) fee = Math.min(fee, Number(rate.maximumFee));

      const performance = await this.getCarrierPerformance(rate.provider.code);
      const reliability = performance?.successRate ?? 0.85;
      const avgMinutes = rate.avgEtaMinutes ?? data.distanceKm * 3;

      // Score calculation based on priority
      let score = 50;
      const reasons: string[] = [];

      // Cost component (lower is better)
      const maxFee = Math.max(...rates.map((r) => Number(r.baseFee) + data.distanceKm * Number(r.perKmFee)));
      const costScore = maxFee > 0 ? (1 - fee / maxFee) * 100 : 50;
      score += costScore * 0.3;
      if (costScore > 70) reasons.push('Competitive pricing');

      // Speed component (lower is better)
      const maxEta = Math.max(...rates.map((r) => r.avgEtaMinutes ?? 120));
      const speedScore = maxEta > 0 ? (1 - avgMinutes / maxEta) * 100 : 50;
      score += speedScore * 0.3;
      if (speedScore > 70) reasons.push('Fast delivery');

      // Reliability component
      score += reliability * 100 * 0.4;
      if (reliability > 0.9) reasons.push('High reliability');

      suggestions.push({
        carrier: rate.provider.code,
        score: Math.min(100, Math.round(score)),
        estimatedFee: Math.round(fee * 100) / 100,
        estimatedMinutes: Math.round(avgMinutes),
        reliability: Math.round(reliability * 100) / 100,
        reasons,
      });
    }

    // Sort based on priority
    const sortBy = data.priority === 'cheapest' ? 'estimatedFee'
      : data.priority === 'fastest' ? 'estimatedMinutes'
      : 'score';

    return suggestions.sort((a, b) => a[sortBy] - b[sortBy]);
  }

  /**
   * Optimize route for multiple deliveries (nearest-neighbor heuristic).
   */
  async optimizeRoute(deliveries: Array<{
    id: string;
    lat: number;
    lng: number;
  }>): Promise<RouteOptimization> {
    if (deliveries.length <= 1) {
      return {
        optimizedOrder: deliveries.map((d) => d.id),
        totalDistanceKm: 0,
        estimatedTotalMinutes: 0,
        savings: { distanceKm: 0, minutes: 0 },
      };
    }

    // Nearest-neighbor TSP heuristic
    const unvisited = [...deliveries];
    const optimized: string[] = [];
    let current = unvisited.shift()!;
    optimized.push(current.id);

    while (unvisited.length > 0) {
      let nearest = unvisited[0];
      let minDist = this.haversineDistance(current.lat, current.lng, nearest.lat, nearest.lng);

      for (let i = 1; i < unvisited.length; i++) {
        const dist = this.haversineDistance(current.lat, current.lng, unvisited[i].lat, unvisited[i].lng);
        if (dist < minDist) {
          minDist = dist;
          nearest = unvisited[i];
        }
      }

      unvisited.splice(unvisited.indexOf(nearest), 1);
      optimized.push(nearest.id);
      current = nearest;
    }

    // Calculate total distance
    let totalDistanceKm = 0;
    for (let i = 0; i < optimized.length - 1; i++) {
      const from = deliveries.find((d) => d.id === optimized[i])!;
      const to = deliveries.find((d) => d.id === optimized[i + 1])!;
      totalDistanceKm += this.haversineDistance(from.lat, from.lng, to.lat, to.lng);
    }

    // Naive order total (without optimization)
    const naiveDistance = deliveries.reduce((sum, d, i) => {
      if (i === 0) return 0;
      return sum + this.haversineDistance(
        deliveries[i - 1].lat, deliveries[i - 1].lng,
        d.lat, d.lng,
      );
    }, 0);

    return {
      optimizedOrder: optimized,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      estimatedTotalMinutes: Math.round(totalDistanceKm * 3),
      savings: {
        distanceKm: Math.round((naiveDistance - totalDistanceKm) * 10) / 10,
        minutes: Math.round((naiveDistance - totalDistanceKm) * 3),
      },
    };
  }

  // --- Private helpers ---

  private async getCarrierPerformance(carrier: string): Promise<{
    successRate: number;
    avgDeliveryMinutes: number;
  } | null> {
    const recent = await this.db.delivery.findMany({
      where: { carrier: carrier as never },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (recent.length < 5) return null;

    const delivered = recent.filter((d) => d.status === 'DELIVERED');
    const successRate = delivered.length / recent.length;

    const deliveryTimes = delivered
      .filter((d) => d.pickedUpAt && d.deliveredAt)
      .map((d) => (d.deliveredAt!.getTime() - d.pickedUpAt!.getTime()) / 60000);

    const avgDeliveryMinutes = deliveryTimes.length > 0
      ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
      : 60;

    return { successRate, avgDeliveryMinutes };
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

export const deliveryAiService = new DeliveryAiService();
