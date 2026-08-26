import type { Delivery } from '@prisma/client';
import { buildLogisticsProviders, type LogisticsProvider } from '@wco/logistics';
import type { CarrierTrackingStatus } from '@wco/logistics';
import { AppError, NotFoundError, ValidationError } from '@wco/shared';

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

/**
 * Logistics service — carrier-agnostic fulfilment on top of @wco/logistics.
 *
 * Quotes are ephemeral (provider TTL ~15min) and persisted as Delivery rows
 * with status QUOTED; booking is idempotent by clientReference = deliveryId,
 * so a merchant mashing "Book" cannot create duplicate shipments.
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

export class DeliveriesService {
  constructor(private readonly db: typeof prisma = prisma) {}

  listConfigured(): string[] {
    return Object.entries(PROVIDERS)
      .filter(([, p]) => p.isConfigured())
      .map(([carrier]) => carrier);
  }

  /**
   * Quote across configured carriers (or one specific carrier), persisting
   * the cheapest as the QUOTED delivery row. Returns all quotes for UI display.
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
    if (candidates.length === 0) throw new AppError('PROVIDER_UNAVAILABLE', 'No delivery provider is available for this route');

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
      throw new AppError('PROVIDER_UNAVAILABLE', 'No delivery provider is available for this route');
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

  /** Book with the quoted carrier. Idempotent per delivery row. */
  async book(storeId: string, deliveryId: string): Promise<Delivery> {
    return this.db.$transaction(async (tx) => {
      const delivery = await tx.delivery.findFirst({ where: { id: deliveryId, storeId } });
      if (!delivery) throw new NotFoundError('Delivery');
      if (delivery.status === 'BOOKED' && delivery.trackingCode) return delivery; // replay-safe
      if (!['QUOTED', 'BOOKED'].includes(delivery.status)) {
        throw new ValidationError(`Cannot book a shipment in status ${delivery.status}`);
      }

      const psp = PROVIDERS[delivery.carrier];
      if (!psp.isConfigured()) throw new AppError('PROVIDER_UNAVAILABLE', 'No delivery provider is available for this route');

      const booking = await psp.book({
        clientReference: delivery.id,
        pickupAddress: delivery.pickupAddress ?? '',
        dropoffAddress: delivery.dropoffAddress ?? '',
        recipientPhone: delivery.recipientPhone ?? '',
        recipientName: delivery.recipientName ?? undefined,
        packageDescription: `WCO order ${delivery.orderId}`,
      });

      await tx.delivery.update({
        where: { id: delivery.id },
        data: {
          status: booking.status === 'BOOKED' ? 'BOOKED' : 'BOOKED', // PENDING normalizes to BOOKED w/ meta flag
          trackingCode: booking.trackingCode,
          bookedAt: new Date(),
          meta: { providerBookingId: booking.bookingId, providerStatus: booking.status },
        },
      });
      // Order moves to PROCESSING once a carrier is engaged.
      await tx.order.updateMany({
        where: { id: delivery.orderId, status: 'PAID' },
        data: { status: 'PROCESSING' },
      });
      return tx.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
    });
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
    const now = new Date();
    const updated = await this.db.delivery.update({
      where: { id: delivery.id },
      data: {
        status: nextStatus,
        ...(update.status === 'PICKED_UP' ? { pickedUpAt: now } : {}),
        ...(update.status === 'DELIVERED' ? { deliveredAt: now } : {}),
        ...(update.status === 'FAILED' ? { failedAt: now, failureReason: update.note } : {}),
        meta: { lastLocation: update.location, lastNote: update.note, lastUpdateAt: now.toISOString() },
      },
    });

    if (update.status === 'DELIVERED') {
      await this.db.order.updateMany({
        where: { id: delivery.orderId, status: { in: ['SHIPPED', 'PROCESSING'] } },
        data: { status: 'DELIVERED', deliveredAt: now },
      });
    }
    if (update.status === 'PICKED_UP') {
      await this.db.order.updateMany({
        where: { id: delivery.orderId, status: 'PROCESSING' },
        data: { status: 'SHIPPED', shippedAt: now },
      });
    }
    return updated;
  }

  async get(storeId: string, orderId: string): Promise<Delivery> {
    const delivery = await this.db.delivery.findFirst({ where: { orderId, storeId } });
    if (!delivery) throw new NotFoundError('Delivery');
    return delivery;
  }
}

export const deliveriesService = new DeliveriesService();

