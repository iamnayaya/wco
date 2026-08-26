import type { DeliveryRate } from '@prisma/client';
import { NotFoundError, ConflictError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * DeliveryRateService — delivery rate card management.
 *
 * Manages rate cards per delivery provider, used for cost calculation
 * and delivery fee estimation.
 */
export class DeliveryRateService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async listByProvider(
    providerId: string,
    page: number,
    pageSize: number,
  ): Promise<DeliveryRate[]> {
    return this.db.deliveryRate.findMany({
      where: { deliveryProviderId: providerId },
      orderBy: [{ baseFee: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async countByProvider(providerId: string): Promise<number> {
    return this.db.deliveryRate.count({ where: { deliveryProviderId: providerId } });
  }

  async getById(providerId: string, id: string): Promise<DeliveryRate> {
    const rate = await this.db.deliveryRate.findFirst({
      where: { id, deliveryProviderId: providerId },
    });
    if (!rate) throw new NotFoundError('Delivery rate');
    return rate;
  }

  async create(providerId: string, data: {
    name: string;
    baseFee: number;
    perKmFee?: number;
    perKgFee?: number;
    minimumFee?: number;
    maximumFee?: number;
    freeThresholdKm?: number;
    avgEtaMinutes?: number;
    maxWeightKg?: number;
    maxDimensionsCm?: number;
    isActive?: boolean;
    meta?: Record<string, unknown>;
  }): Promise<DeliveryRate> {
    const provider = await this.db.deliveryProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new NotFoundError('Delivery provider');

    const rate = await this.db.deliveryRate.create({
      data: {
        deliveryProviderId: providerId,
        name: data.name,
        baseFee: data.baseFee,
        perKmFee: data.perKmFee ?? 0,
        perKgFee: data.perKgFee ?? 0,
        minimumFee: data.minimumFee ?? 0,
        maximumFee: data.maximumFee,
        freeThresholdKm: data.freeThresholdKm,
        avgEtaMinutes: data.avgEtaMinutes,
        maxWeightKg: data.maxWeightKg,
        maxDimensionsCm: data.maxDimensionsCm,
        isActive: data.isActive ?? true,
        meta: data.meta ?? {},
      },
    });

    logger.info('delivery-rate.created', { rateId: rate.id, providerId });
    return rate;
  }

  async update(providerId: string, id: string, data: Partial<{
    name: string;
    baseFee: number;
    perKmFee: number;
    perKgFee: number;
    minimumFee: number;
    maximumFee: number;
    freeThresholdKm: number;
    avgEtaMinutes: number;
    maxWeightKg: number;
    maxDimensionsCm: number;
    isActive: boolean;
    meta: Record<string, unknown>;
  }>): Promise<DeliveryRate> {
    await this.getById(providerId, id);

    const updated = await this.db.deliveryRate.update({
      where: { id },
      data: data as never,
    });

    logger.info('delivery-rate.updated', { rateId: id });
    return updated;
  }

  async remove(providerId: string, id: string): Promise<void> {
    const rate = await this.getById(providerId, id);
    await this.db.deliveryRate.delete({ where: { id: rate.id } });
    logger.info('delivery-rate.deleted', { rateId: id });
  }

  /**
   * Calculate delivery cost based on distance, weight, and dimensions.
   */
  async calculateRate(
    providerId: string,
    distanceKm: number,
    weight?: number,
    dimensions?: { length: number; width: number; height: number },
  ): Promise<{ rate: DeliveryRate; fee: number; etaMinutes: number | null }> {
    const rates = await this.db.deliveryRate.findMany({
      where: { deliveryProviderId: providerId, isActive: true },
      orderBy: { baseFee: 'asc' },
    });

    if (rates.length === 0) throw new NotFoundError('No active rates for this provider');

    // Find the best matching rate
    for (const rate of rates) {
      if (rate.maxWeightKg && weight && weight > rate.maxWeightKg) continue;
      if (rate.maxDimensionsCm && dimensions) {
        const total = dimensions.length + dimensions.width + dimensions.height;
        if (total > rate.maxDimensionsCm) continue;
      }

      let fee = Number(rate.baseFee);
      if (rate.freeThresholdKm && distanceKm <= rate.freeThresholdKm) {
        fee = 0;
      } else {
        fee += distanceKm * Number(rate.perKmFee);
        if (weight) fee += weight * Number(rate.perKgFee);
      }
      fee = Math.max(fee, Number(rate.minimumFee));
      if (rate.maximumFee) fee = Math.min(fee, Number(rate.maximumFee));
      fee = Math.round(fee * 100) / 100;

      return { rate, fee, etaMinutes: rate.avgEtaMinutes };
    }

    // Fallback to first rate
    const fallback = rates[0];
    let fee = Number(fallback.baseFee);
    fee += distanceKm * Number(fallback.perKmFee);
    if (weight) fee += weight * Number(fallback.perKgFee);
    fee = Math.max(fee, Number(fallback.minimumFee));
    fee = Math.round(fee * 100) / 100;

    return { rate: fallback, fee, etaMinutes: fallback.avgEtaMinutes };
  }
}

export const deliveryRateService = new DeliveryRateService();
