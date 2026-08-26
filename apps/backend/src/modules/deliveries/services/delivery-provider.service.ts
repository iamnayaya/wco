import type { DeliveryProvider } from '@prisma/client';
import { NotFoundError, ConflictError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';
import { createHash } from 'node:crypto';

/**
 * DeliveryProviderService — platform delivery provider registry management.
 *
 * Manages platform-level delivery providers (GIG, Kwik, Sendy) with
 * credentials encryption, rate cards, and availability checks.
 */
export class DeliveryProviderService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async list(
    page: number,
    pageSize: number,
    filters: { isActive?: boolean; country?: string } = {},
  ): Promise<DeliveryProvider[]> {
    const where: Record<string, unknown> = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.country) where.countries = { has: filters.country };

    return this.db.deliveryProvider.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async count(filters: { isActive?: boolean; country?: string } = {}): Promise<number> {
    const where: Record<string, unknown> = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.country) where.countries = { has: filters.country };
    return this.db.deliveryProvider.count({ where: where as never });
  }

  async getById(id: string): Promise<DeliveryProvider> {
    const provider = await this.db.deliveryProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundError('Delivery provider');
    return provider;
  }

  async getByCode(code: string): Promise<DeliveryProvider> {
    const provider = await this.db.deliveryProvider.findUnique({ where: { code } });
    if (!provider) throw new NotFoundError('Delivery provider');
    return provider;
  }

  async create(data: {
    code: string;
    name: string;
    countries: string[];
    cities: string[];
    baseFee: number;
    perKmFee?: number;
    avgEtaMinutes?: number;
    webhookSecret?: string;
    isActive?: boolean;
    meta?: Record<string, unknown>;
  }): Promise<DeliveryProvider> {
    const existing = await this.db.deliveryProvider.findUnique({ where: { code: data.code } });
    if (existing) throw new ConflictError(`Provider code "${data.code}" already exists`);

    const webhookSecretHash = data.webhookSecret
      ? createHash('sha256').update(data.webhookSecret).digest('hex')
      : undefined;

    const provider = await this.db.deliveryProvider.create({
      data: {
        code: data.code,
        name: data.name,
        countries: data.countries,
        cities: data.cities,
        baseFee: data.baseFee,
        perKmFee: data.perKmFee ?? 0,
        avgEtaMinutes: data.avgEtaMinutes,
        webhookSecretHash,
        isActive: data.isActive ?? true,
        meta: data.meta ?? {},
      },
    });

    logger.info('delivery-provider.created', { providerId: provider.id, code: provider.code });
    return provider;
  }

  async update(id: string, data: {
    name?: string;
    countries?: string[];
    cities?: string[];
    baseFee?: number;
    perKmFee?: number;
    avgEtaMinutes?: number;
    webhookSecret?: string;
    isActive?: boolean;
    meta?: Record<string, unknown>;
  }): Promise<DeliveryProvider> {
    await this.getById(id);

    const updateData: Record<string, unknown> = { ...data };
    if (data.webhookSecret) {
      updateData.webhookSecretHash = createHash('sha256').update(data.webhookSecret).digest('hex');
      delete updateData.webhookSecret;
    }

    const updated = await this.db.deliveryProvider.update({
      where: { id },
      data: updateData as never,
    });

    logger.info('delivery-provider.updated', { providerId: id });
    return updated;
  }

  async remove(id: string): Promise<void> {
    const provider = await this.getById(id);
    const activeDeliveries = await this.db.delivery.count({
      where: { deliveryProviderId: id, status: { in: ['BOOKED', 'PICKED_UP', 'IN_TRANSIT'] } },
    });
    if (activeDeliveries > 0) {
      throw new ConflictError('Cannot remove provider with active deliveries');
    }
    await this.db.deliveryProvider.delete({ where: { id: provider.id } });
    logger.info('delivery-provider.deleted', { providerId: id });
  }

  async getAvailableProviders(
    pickupAddress: string,
    dropoffAddress: string,
    weight?: number,
    dimensions?: { length: number; width: number; height: number },
  ): Promise<DeliveryProvider[]> {
    const providers = await this.db.deliveryProvider.findMany({
      where: { isActive: true },
    });

    return providers.filter((p) => {
      if (dimensions && p.meta && typeof p.meta === 'object') {
        const maxDimensions = (p.meta as Record<string, unknown>).maxDimensionsCm as number | undefined;
        if (maxDimensions) {
          const total = dimensions.length + dimensions.width + dimensions.height;
          if (total > maxDimensions) return false;
        }
      }
      if (weight) {
        const maxWeight = (p.meta as Record<string, unknown>)?.maxWeightKg as number | undefined;
        if (maxWeight && weight > maxWeight) return false;
      }
      return true;
    });
  }
}

export const deliveryProviderService = new DeliveryProviderService();
