import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { DeliveryQuote, LogisticsProvider } from '@wco/logistics';
import { buildLogisticsProviders } from '@wco/logistics';
import { PrismaService } from '@wco/database';
import { OrdersEventPublisher } from '../orders/orders.event-publisher';
import { TenantContext } from '../../common/context/tenant-context';

/**
 * LogisticsService — "arrange delivery in 2 minutes".
 *
 * 1. quoteAll: fan out to every configured carrier IN PARALLEL; a slow or
 *    failing carrier never blocks the others (Promise.allSettled).
 * 2. book: persist Delivery atomically with the chosen carrier + emit
 *    shipment.booked for WhatsApp tracking-link delivery.
 */
@Injectable()
export class LogisticsService {
  private readonly carriers: Record<string, LogisticsProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OrdersEventPublisher,
  ) {
    this.carriers = buildLogisticsProviders();
  }

  async quoteOrder(orderId: string) {
    const { storeId } = TenantContext.require();
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: {
        customer: { select: { waPhone: true } },
        items: { select: { productName: true, quantity: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const pickup = order.deliveryAddress ?? 'Store address on file';
    const dropoff = order.deliveryAddress;
    if (!dropoff) throw new BadRequestException('Order has no delivery address');

    const packageName =
      order.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ') || 'WCO package';

    const settled = await Promise.allSettled(
      Object.values(this.carriers)
        .filter((c) => c.isConfigured())
        .map((carrier) =>
          carrier.quote({
            pickupAddress: pickup,
            dropoffAddress: dropoff,
            recipientPhone: order.customer.waPhone,
            packageName,
          }),
        ),
    );

    const quotes = settled
      .filter((s): s is PromiseFulfilledResult<DeliveryQuote> => s.status === 'fulfilled')
      .map((s) => s.value);

    // Persist best-effort QUOTED row so merchant can book later from history
    if (quotes.length > 0) {
      const cheapest = quotes.reduce((a, b) => (a.fee <= b.fee ? a : b));
      await this.prisma.delivery.upsert({
        where: { orderId: order.id },
        create: {
          storeId,
          orderId: order.id,
          carrier: cheapest.carrier,
          status: 'QUOTED',
          fee: cheapest.fee,
          etaMinutes: cheapest.etaMinutes,
          meta: { quotes } as never,
        },
        update: { status: 'QUOTED', fee: cheapest.fee, etaMinutes: cheapest.etaMinutes },
      });
      await this.events.emit({
        aggregateType: 'shipment',
        aggregateId: order.id,
        storeId,
        eventType: 'shipment.quoted',
        payload: { orderId, quoteCount: quotes.length },
      });
    }

    return {
      quotes: quotes.sort((a, b) => a.fee - b.fee),
      failedCarriers: settled
        .filter((s) => s.status === 'rejected')
        .map(() => 'unavailable'), // provider names omitted — internal detail
    };
  }

  async book(orderId: string, carrier: string, quoteId?: string) {
    const { storeId } = TenantContext.require();
    const provider = this.carriers[carrier];
    if (!provider || !provider.isConfigured()) {
      throw new BadRequestException(`Carrier ${carrier} not available`);
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
      include: { customer: { select: { waPhone: true } }, delivery: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.delivery?.status && !['QUOTED'].includes(order.delivery.status)) {
      throw new BadRequestException(`Delivery already ${order.delivery.status}`);
    }
    if (!order.deliveryAddress) throw new BadRequestException('Order has no delivery address');

    const booking = await provider.book({
      clientReference: order.orderNumber,
      quoteId,
      pickupAddress: 'Store address on file',
      dropoffAddress: order.deliveryAddress,
      recipientPhone: order.customer.waPhone,
      packageDescription: `WCO order ${order.orderNumber}`,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.delivery.upsert({
        where: { orderId: order.id },
        create: {
          storeId,
          orderId: order.id,
          carrier: carrier as never,
          trackingCode: booking.trackingCode,
          status: booking.status === 'BOOKED' ? 'BOOKED' : 'QUOTED',
          dropoffAddress: order.deliveryAddress,
          recipientPhone: order.customer.waPhone,
          etaMinutes: booking.etaMinutes,
          bookedAt: new Date(),
        },
        update: {
          carrier: carrier as never,
          trackingCode: booking.trackingCode,
          status: booking.status === 'BOOKED' ? 'BOOKED' : 'QUOTED',
          bookedAt: new Date(),
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: 'PROCESSING' } });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'shipment',
          aggregateId: order.id,
          eventType: 'shipment.booked',
          payload: {
            storeId,
            orderId,
            carrier,
            trackingCode: booking.trackingCode,
            customerWaPhone: order.customer.waPhone,
          } as never,
        },
      });
    });

    return booking;
  }

  async listDeliveries() {
    const { storeId } = TenantContext.require();
    return this.prisma.delivery.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        orderId: true,
        carrier: true,
        trackingCode: true,
        status: true,
        fee: true,
        etaMinutes: true,
        bookedAt: true,
        createdAt: true,
      },
    });
  }

  async track(deliveryId: string) {
    const { storeId } = TenantContext.require();
    const delivery = await this.prisma.delivery.findFirst({ where: { id: deliveryId, storeId } });
    if (!delivery?.trackingCode) throw new NotFoundException('Delivery not tracked yet');

    const provider = this.carriers[delivery.carrier as string];
    if (!provider) throw new BadRequestException('Carrier no longer configured');
    return provider.track(delivery.trackingCode);
  }
}
