import type { DeliveryClaim } from '@prisma/client';
import { NotFoundError, ValidationError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * DeliveryClaimService — delivery claim management.
 *
 * Handles creation, processing, approval, and rejection of delivery
 * claims for lost, damaged, delayed, or incorrect deliveries.
 */
export class DeliveryClaimService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async listByDelivery(
    deliveryId: string,
    page: number,
    pageSize: number,
    filters: { status?: string } = {},
  ): Promise<DeliveryClaim[]> {
    const where: Record<string, unknown> = { deliveryId };
    if (filters.status) where.status = filters.status;

    return this.db.deliveryClaim.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async countByDelivery(deliveryId: string, status?: string): Promise<number> {
    const where: Record<string, unknown> = { deliveryId };
    if (status) where.status = status;
    return this.db.deliveryClaim.count({ where: where as never });
  }

  async listByStore(
    storeId: string,
    page: number,
    pageSize: number,
    filters: { status?: string } = {},
  ): Promise<DeliveryClaim[]> {
    const where: Record<string, unknown> = { storeId };
    if (filters.status) where.status = filters.status;

    return this.db.deliveryClaim.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async countByStore(storeId: string, status?: string): Promise<number> {
    const where: Record<string, unknown> = { storeId };
    if (status) where.status = status;
    return this.db.deliveryClaim.count({ where: where as never });
  }

  async getById(deliveryId: string, claimId: string): Promise<DeliveryClaim> {
    const claim = await this.db.deliveryClaim.findFirst({
      where: { id: claimId, deliveryId },
    });
    if (!claim) throw new NotFoundError('Delivery claim');
    return claim;
  }

  async create(
    deliveryId: string,
    storeId: string,
    data: {
      type: string;
      description?: string;
      evidenceUrls?: string[];
    },
  ): Promise<DeliveryClaim> {
    const delivery = await this.db.delivery.findFirst({ where: { id: deliveryId, storeId } });
    if (!delivery) throw new NotFoundError('Delivery');

    const existing = await this.db.deliveryClaim.findFirst({
      where: { deliveryId, status: { in: ['PENDING', 'PROCESSING'] } },
    });
    if (existing) throw new ValidationError('An open claim already exists for this delivery');

    const claim = await this.db.deliveryClaim.create({
      data: {
        deliveryId,
        storeId,
        type: data.type as never,
        status: 'PENDING',
        description: data.description,
        evidenceUrls: data.evidenceUrls ?? [],
      },
    });

    logger.info('delivery-claim.created', { claimId: claim.id, deliveryId, type: data.type });
    return claim;
  }

  async update(
    deliveryId: string,
    claimId: string,
    data: Partial<{
      type: string;
      description: string;
      evidenceUrls: string[];
    }>,
  ): Promise<DeliveryClaim> {
    const claim = await this.getById(deliveryId, claimId);
    if (!['PENDING'].includes(claim.status)) {
      throw new ValidationError(`Cannot update claim in status ${claim.status}`);
    }

    const updated = await this.db.deliveryClaim.update({
      where: { id: claimId },
      data: data as never,
    });

    logger.info('delivery-claim.updated', { claimId });
    return updated;
  }

  async remove(deliveryId: string, claimId: string): Promise<void> {
    const claim = await this.getById(deliveryId, claimId);
    if (!['PENDING'].includes(claim.status)) {
      throw new ValidationError(`Cannot delete claim in status ${claim.status}`);
    }
    await this.db.deliveryClaim.delete({ where: { id: claimId } });
    logger.info('delivery-claim.deleted', { claimId });
  }

  async process(
    claimId: string,
    data: {
      status: string;
      resolution?: string;
      payoutAmount?: number;
    },
  ): Promise<DeliveryClaim> {
    const claim = await this.db.deliveryClaim.findUnique({ where: { id: claimId } });
    if (!claim) throw new NotFoundError('Delivery claim');
    if (!['PENDING', 'PROCESSING'].includes(claim.status)) {
      throw new ValidationError(`Cannot process claim in status ${claim.status}`);
    }

    const updated = await this.db.deliveryClaim.update({
      where: { id: claimId },
      data: {
        status: data.status as never,
        resolution: data.resolution,
        payoutAmount: data.payoutAmount,
        resolvedAt: new Date(),
      },
    });

    logger.info('delivery-claim.processed', { claimId, status: data.status });
    return updated;
  }
}

export const deliveryClaimService = new DeliveryClaimService();
