import type { DeliveryTracking } from '@prisma/client';
import { NotFoundError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * DeliveryTrackingService — tracking event management for deliveries.
 *
 * Maintains an append-only audit log of all delivery status changes,
 * sourced from webhooks, polling, or manual updates.
 */
export class DeliveryTrackingService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async listByDelivery(
    deliveryId: string,
    page: number,
    pageSize: number,
  ): Promise<DeliveryTracking[]> {
    return this.db.deliveryTracking.findMany({
      where: { deliveryId },
      orderBy: { occurredAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async countByDelivery(deliveryId: string): Promise<number> {
    return this.db.deliveryTracking.count({ where: { deliveryId } });
  }

  async getCurrentStatus(deliveryId: string): Promise<DeliveryTracking | null> {
    return this.db.deliveryTracking.findFirst({
      where: { deliveryId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async create(deliveryId: string, data: {
    status: string;
    location?: string;
    note?: string;
    source?: string;
    occurredAt?: Date;
    meta?: Record<string, unknown>;
  }): Promise<DeliveryTracking> {
    const event = await this.db.deliveryTracking.create({
      data: {
        deliveryId,
        status: data.status as never,
        location: data.location,
        note: data.note,
        source: data.source ?? 'manual',
        occurredAt: data.occurredAt ?? new Date(),
        meta: data.meta ?? {},
      },
    });

    logger.info('delivery-tracking.created', { deliveryId, status: data.status });
    return event;
  }

  async getByDeliveryId(deliveryId: string): Promise<DeliveryTracking[]> {
    return this.db.deliveryTracking.findMany({
      where: { deliveryId },
      orderBy: { occurredAt: 'desc' },
    });
  }
}

export const deliveryTrackingService = new DeliveryTrackingService();
