import type { Delivery } from '@prisma/client';
import { buildLogisticsProviders, type LogisticsProvider } from '@wco/logistics';
import type { CarrierTrackingStatus } from '@wco/logistics';
import { AppError, NotFoundError, ValidationError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * DeliveryService — core delivery lifecycle management.
 *
 * Handles creation, booking, tracking, cancellation, cost calculation,
 * and analytics for deliveries across all logistics providers.
 */

const PROVIDERS: Record<string, LogisticsProvider> = buildLogisticsProviders();

const TRACKING_TO_DELIVERY_STATUS: Record<CarrierTrackingStatus, Delivery['status']> = {
  BOOKED: 'BOOKED',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

export interface QuoteRequest {
  readonly pickupAddress: string;
  readonly dropoffAddress: string;
  readonly recipientName?: string;
  readonly recipientPhone: string;
  readonly packageName?: string;
  readonly packageWeightKg?: number;
}

export class DeliveryService {
  constructor(private readonly db: typeof prisma = prisma) {}

  listConfigured(): string[] {
    return Object.entries(PROVIDERS)
      .filter(([, p]) => p.isConfigured())
      .map(([carrier]) => carrier);
  }

  async list(
    storeId: string,
    page: number,
    pageSize: number,
    filters: {
      status?: string;
      carrier?: string;
      from?: Date;
      to?: Date;
      q?: string;
      sortBy?: string;
      sortOrder?: string;
    } = {},
  ): Promise<Delivery[]> {
    const where: Record<string, unknown> = { storeId };
    if (filters.status) where.status = filters.status;
    if (filters.carrier) where.carrier = filters.carrier;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Record<string, unknown>).gte = filters.from;
      if (filters.to) (where.createdAt as Record<string, unknown>).lte = filters.to;
    }
    if (filters.q) {
      where.OR = [
        { trackingCode: { contains: filters.q, mode: 'insensitive' } },
        { recipientName: { contains: filters.q, mode: 'insensitive' } },
        { pickupAddress: { contains: filters.q, mode: 'insensitive' } },
        { dropoffAddress: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    const orderByField = filters.sortBy || 'createdAt';
    const orderByDir = filters.sortOrder || 'desc';

    return this.db.delivery.findMany({
      where: where as never,
      orderBy: { [orderByField]: orderByDir as 'asc' | 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async count(
    storeId: string,
    filters: {
      status?: string;
      carrier?: string;
      from?: Date;
      to?: Date;
      q?: string;
    } = {},
  ): Promise<number> {
    const where: Record<string, unknown> = { storeId };
    if (filters.status) where.status = filters.status;
    if (filters.carrier) where.carrier = filters.carrier;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Record<string, unknown>).gte = filters.from;
      if (filters.to) (where.createdAt as Record<string, unknown>).lte = filters.to;
    }
    if (filters.q) {
      where.OR = [
        { trackingCode: { contains: filters.q, mode: 'insensitive' } },
        { recipientName: { contains: filters.q, mode: 'insensitive' } },
      ];
    }
    return this.db.delivery.count({ where: where as never });
  }

  async getById(storeId: string, id: string): Promise<Delivery> {
    const delivery = await this.db.delivery.findFirst({ where: { id, storeId } });
    if (!delivery) throw new NotFoundError('Delivery');
    return delivery;
  }

  async getByOrderId(storeId: string, orderId: string): Promise<Delivery> {
    const delivery = await this.db.delivery.findFirst({ where: { orderId, storeId } });
    if (!delivery) throw new NotFoundError('Delivery');
    return delivery;
  }

  async create(storeId: string, data: {
    orderId: string;
    deliveryProviderId?: string;
    carrier?: string;
    pickupAddress: string;
    pickupLat?: number;
    pickupLng?: number;
    dropoffAddress: string;
    dropoffLat?: number;
    dropoffLng?: number;
    recipientName?: string;
    recipientPhone: string;
    packageDescription?: string;
    packageWeightKg?: number;
    packageLengthCm?: number;
    packageWidthCm?: number;
    packageHeightCm?: number;
    insuranceAmount?: number;
    codAmount?: number;
    meta?: Record<string, unknown>;
  }): Promise<Delivery> {
    const order = await this.db.order.findFirst({ where: { id: data.orderId, storeId } });
    if (!order) throw new NotFoundError('Order');

    const existing = await this.db.delivery.findFirst({ where: { orderId: data.orderId } });
    if (existing) throw new ValidationError('Delivery already exists for this order');

    const delivery = await this.db.delivery.create({
      data: {
        storeId,
        orderId: data.orderId,
        deliveryProviderId: data.deliveryProviderId,
        carrier: (data.carrier || 'MANUAL') as never,
        status: 'QUOTED',
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        recipientName: data.recipientName,
        recipientPhone: data.recipientPhone,
        packageDescription: data.packageDescription,
        packageWeightKg: data.packageWeightKg,
        packageLengthCm: data.packageLengthCm,
        packageWidthCm: data.packageWidthCm,
        packageHeightCm: data.packageHeightCm,
        insuranceAmount: data.insuranceAmount,
        codAmount: data.codAmount,
        quotedAt: new Date(),
        meta: data.meta ?? {},
      },
    });

    logger.info('delivery.created', { deliveryId: delivery.id, storeId, orderId: data.orderId });
    return delivery;
  }

  async update(storeId: string, id: string, data: Partial<{
    deliveryProviderId: string;
    carrier: string;
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    dropoffAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    recipientName: string;
    recipientPhone: string;
    packageDescription: string;
    packageWeightKg: number;
    packageLengthCm: number;
    packageWidthCm: number;
    packageHeightCm: number;
    meta: Record<string, unknown>;
  }>): Promise<Delivery> {
    const delivery = await this.getById(storeId, id);
    if (!['QUOTED'].includes(delivery.status)) {
      throw new ValidationError(`Cannot update delivery in status ${delivery.status}`);
    }

    const updated = await this.db.delivery.update({
      where: { id: delivery.id },
      data: data as never,
    });

    logger.info('delivery.updated', { deliveryId: id });
    return updated;
  }

  async remove(storeId: string, id: string): Promise<void> {
    const delivery = await this.getById(storeId, id);
    if (!['QUOTED', 'CANCELLED', 'FAILED'].includes(delivery.status)) {
      throw new ValidationError(`Cannot delete delivery in status ${delivery.status}`);
    }
    await this.db.delivery.delete({ where: { id: delivery.id } });
    logger.info('delivery.deleted', { deliveryId: id });
  }

  /**
   * Quote across configured carriers, persisting the cheapest as QUOTED.
   */
  async quote(
    storeId: string,
    orderId: string,
    request: QuoteRequest,
    carrierFilter?: string,
  ): Promise<{ quotes: unknown[]; delivery: Delivery }> {
    const order = await this.db.order.findFirst({ where: { id: orderId, storeId } });
    if (!order) throw new NotFoundError('Order');
    if (!request.pickupAddress || !request.dropoffAddress) {
      throw new ValidationError('Pickup and dropoff addresses are required');
    }

    const candidates = Object.values(PROVIDERS).filter(
      (p) => p.isConfigured() && (!carrierFilter || p.carrier === carrierFilter),
    );
    if (candidates.length === 0) throw new AppError('PROVIDER_UNAVAILABLE', 'No delivery provider available for this route');

    const quotes = await Promise.allSettled(
      candidates.map((p) =>
        p.quote({
          pickupAddress: request.pickupAddress,
          dropoffAddress: request.dropoffAddress,
          recipientPhone: request.recipientPhone,
          packageName: request.packageName ?? `Order ${order.orderNumber}`,
          packageWeightKg: request.packageWeightKg,
        }),
      ),
    );

    const succeeded = quotes
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<LogisticsProvider['quote']>>> => r.status === 'fulfilled')
      .map((r) => r.value);
    if (succeeded.length === 0) {
      logger.error('logistics.all-providers-failed', { orderId });
      throw new AppError('PROVIDER_UNAVAILABLE', 'No delivery provider available for this route');
    }

    const best = succeeded.reduce((a, b) => (b.fee < a.fee ? b : a));
    const delivery = await this.db.delivery.upsert({
      where: { orderId },
      create: {
        storeId,
        orderId,
        carrier: best.carrier,
        status: 'QUOTED',
        pickupAddress: request.pickupAddress,
        dropoffAddress: request.dropoffAddress,
        recipientName: request.recipientName,
        recipientPhone: request.recipientPhone,
        fee: best.fee,
        etaMinutes: best.etaMinutes,
        quotedAt: new Date(),
        meta: { allQuotes: succeeded.map((q) => ({ carrier: q.carrier, fee: q.fee, etaMinutes: q.etaMinutes })) },
      },
      update: {
        carrier: best.carrier,
        status: 'QUOTED',
        fee: best.fee,
        etaMinutes: best.etaMinutes,
        quotedAt: new Date(),
        pickupAddress: request.pickupAddress,
        dropoffAddress: request.dropoffAddress,
      },
    });

    return { quotes: succeeded, delivery };
  }

  /** Book with the quoted carrier. Idempotent per delivery. */
  async book(storeId: string, deliveryId: string): Promise<Delivery> {
    return this.db.$transaction(async (tx) => {
      const delivery = await tx.delivery.findFirst({ where: { id: deliveryId, storeId } });
      if (!delivery) throw new NotFoundError('Delivery');
      if (delivery.status === 'BOOKED' && delivery.trackingCode) return delivery;
      if (!['QUOTED', 'BOOKED'].includes(delivery.status)) {
        throw new ValidationError(`Cannot book shipment in status ${delivery.status}`);
      }

      const psp = PROVIDERS[delivery.carrier];
      if (!psp?.isConfigured()) throw new AppError('PROVIDER_UNAVAILABLE', 'Delivery provider not configured');

      const booking = await psp.book({
        clientReference: delivery.id,
        pickupAddress: delivery.pickupAddress ?? '',
        dropoffAddress: delivery.dropoffAddress ?? '',
        recipientPhone: delivery.recipientPhone ?? '',
        recipientName: delivery.recipientName ?? undefined,
        packageDescription: delivery.packageDescription ?? `WCO order ${delivery.orderId}`,
        codAmount: delivery.codAmount ? Number(delivery.codAmount) : undefined,
      });

      await tx.delivery.update({
        where: { id: delivery.id },
        data: {
          status: 'BOOKED',
          trackingCode: booking.trackingCode,
          bookedAt: new Date(),
          meta: { providerBookingId: booking.bookingId, providerStatus: booking.status },
        },
      });

      await tx.deliveryTracking.create({
        data: {
          deliveryId: delivery.id,
          status: 'BOOKED',
          note: `Booked with ${delivery.carrier}`,
          source: 'system',
        },
      });

      await tx.order.updateMany({
        where: { id: delivery.orderId, status: 'PAID' },
        data: { status: 'PROCESSING' },
      });

      return tx.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
    });
  }

  /** Cancel a delivery that hasn't been picked up yet. */
  async cancel(storeId: string, deliveryId: string, reason?: string): Promise<Delivery> {
    const delivery = await this.getById(storeId, deliveryId);
    if (['DELIVERED', 'CANCELLED'].includes(delivery.status)) {
      throw new ValidationError(`Cannot cancel delivery in status ${delivery.status}`);
    }

    const updated = await this.db.delivery.update({
      where: { id: deliveryId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
        meta: { ...(delivery.meta as Record<string, unknown>), cancelledBy: 'merchant' },
      },
    });

    await this.db.deliveryTracking.create({
      data: {
        deliveryId,
        status: 'CANCELLED',
        note: reason ?? 'Cancelled by merchant',
        source: 'manual',
      },
    });

    logger.info('delivery.cancelled', { deliveryId, reason });
    return updated;
  }

  /** Carrier tracking webhook / polling reconciliation. */
  async handleTrackingUpdate(carrier: string, update: {
    readonly trackingCode: string;
    readonly status: CarrierTrackingStatus;
    readonly occurredAt?: Date;
    readonly location?: string;
    readonly note?: string;
  }): Promise<Delivery | null> {
    const delivery = await this.db.delivery.findFirst({ where: { trackingCode: update.trackingCode } });
    if (!delivery || delivery.carrier !== carrier) {
      logger.warn('logistics.tracking.unknown-code', { carrier, trackingCode: update.trackingCode });
      return null;
    }

    const nextStatus = TRACKING_TO_DELIVERY_STATUS[update.status];
    const now = update.occurredAt ?? new Date();

    const updated = await this.db.$transaction(async (tx) => {
      const d = await tx.delivery.update({
        where: { id: delivery.id },
        data: {
          status: nextStatus,
          ...(update.status === 'PICKED_UP' ? { pickedUpAt: now } : {}),
          ...(update.status === 'IN_TRANSIT' ? { inTransitAt: now } : {}),
          ...(update.status === 'DELIVERED' ? { deliveredAt: now } : {}),
          ...(update.status === 'FAILED' ? { failedAt: now, failureReason: update.note } : {}),
          meta: { lastLocation: update.location, lastNote: update.note, lastUpdateAt: now.toISOString() },
        },
      });

      await tx.deliveryTracking.create({
        data: {
          deliveryId: delivery.id,
          status: nextStatus,
          location: update.location,
          note: update.note,
          source: 'webhook',
          occurredAt: now,
        },
      });

      return d;
    });

    if (update.status === 'PICKED_UP') {
      await this.db.order.updateMany({
        where: { id: delivery.orderId, status: 'PROCESSING' },
        data: { status: 'SHIPPED' },
      });
    }
    if (update.status === 'DELIVERED') {
      await this.db.order.updateMany({
        where: { id: delivery.orderId, status: { in: ['SHIPPED', 'PROCESSING'] } },
        data: { status: 'DELIVERED' },
      });
    }

    return updated;
  }

  /** Calculate delivery cost across providers. */
  async calculateCost(data: {
    pickupAddress: string;
    dropoffAddress: string;
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
    carrier?: string;
    insuranceAmount?: number;
  }): Promise<{ carrier: string; fee: number; currency: string; etaMinutes: number }[]> {
    const candidates = Object.values(PROVIDERS).filter(
      (p) => p.isConfigured() && (!data.carrier || p.carrier === data.carrier),
    );

    const quotes = await Promise.allSettled(
      candidates.map((p) =>
        p.quote({
          pickupAddress: data.pickupAddress,
          dropoffAddress: data.dropoffAddress,
          recipientPhone: '',
          packageName: 'Quote request',
          packageWeightKg: data.weight,
        }),
      ),
    );

    const results = quotes
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<LogisticsProvider['quote']>>> => r.status === 'fulfilled')
      .map((r) => ({
        carrier: r.value.carrier,
        fee: data.insuranceAmount ? r.value.fee + data.insuranceAmount * 0.01 : r.value.fee,
        currency: r.value.currency,
        etaMinutes: r.value.etaMinutes,
      }));

    return results.sort((a, b) => a.fee - b.fee);
  }

  /** Rate a completed delivery. */
  async rate(storeId: string, deliveryId: string, rating: number, comment?: string): Promise<Delivery> {
    const delivery = await this.getById(storeId, deliveryId);
    if (delivery.status !== 'DELIVERED') {
      throw new ValidationError('Can only rate delivered shipments');
    }
    if (delivery.rating) {
      throw new ValidationError('Delivery already rated');
    }

    return this.db.delivery.update({
      where: { id: deliveryId },
      data: { rating, reviewComment: comment },
    });
  }

  /** Delivery statistics. */
  async getStats(
    storeId: string,
    from?: Date,
    to?: Date,
    groupBy: string = 'day',
  ): Promise<Record<string, unknown>> {
    const where: Record<string, unknown> = { storeId };
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Record<string, unknown>).gte = from;
      if (to) (where.createdAt as Record<string, unknown>).lte = to;
    }

    const [total, byStatus, byCarrier, avgFee] = await Promise.all([
      this.db.delivery.count({ where: where as never }),
      this.db.delivery.groupBy({ by: ['status'], where: where as never, _count: { id: true } }),
      this.db.delivery.groupBy({ by: ['carrier'], where: where as never, _count: { id: true } }),
      this.db.delivery.aggregate({ where: { ...where as never, fee: { not: null } }, _avg: { fee: true } }),
    ]);

    return {
      total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
      byCarrier: Object.fromEntries(byCarrier.map((c) => [c.carrier, c._count.id])),
      averageFee: Number(avgFee._avg.fee ?? 0),
    };
  }
}

export const deliveryService = new DeliveryService();
