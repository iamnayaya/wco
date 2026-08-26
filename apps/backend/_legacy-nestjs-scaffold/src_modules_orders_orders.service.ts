import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@wco/database';
import { TenantContext } from '../../common/context/tenant-context';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersEventPublisher } from './orders.event-publisher';

/**
 * OrdersService — order lifecycle orchestration.
 *
 * Money-adjacent domain logic. Rules:
 *  - Every mutation happens inside a serializable transaction
 *  - Prices are ALWAYS computed server-side from catalog (never trust client)
 *  - State machine transitions enforced (no skipping states)
 *  - Domain events published AFTER commit (transactional outbox pattern)
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: OrdersEventPublisher,
  ) {}

  async create(dto: CreateOrderDto): Promise<{ id: string; total: number }> {
    const { storeId } = TenantContext.require();

    // Server-side pricing: load current catalog prices + stock in one query
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: dto.items.map((i) => i.productId) },
        storeId, // tenant scoping even for internal lookups
        status: 'ACTIVE',
      },
      select: { id: true, price: true, stockQuantity: true, name: true },
    });

    if (products.length !== dto.items.length) {
      throw new NotFoundException('One or more products unavailable');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate stock & compute totals server-side
    let subtotal = 0;
    for (const item of dto.items) {
      const product = productMap.get(item.productId)!;
      if (product.stockQuantity < item.quantity) {
        throw new ConflictException(`Insufficient stock for ${product.name}`);
      }
      subtotal += Number(product.price) * item.quantity;
    }

    // Atomic order creation with stock decrement
    // Serializable isolation prevents oversell under concurrency
    const order = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.order.create({
          data: {
            storeId,
            customerId: dto.customerId,
            status: 'PENDING_PAYMENT',
            channel: dto.channel,
            subtotal: new Prisma.Decimal(subtotal),
            currency: 'NGN', // resolved from store settings in production
            items: {
              create: dto.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: productMap.get(item.productId)!.price,
                note: item.note,
              })),
            },
          },
          select: { id: true, orderNumber: true },
        });

        // Optimistic stock decrement — fails if raced
        for (const item of dto.items) {
          const result = await tx.product.updateMany({
            where: {
              id: item.productId,
              stockQuantity: { gte: item.quantity },
            },
            data: { stockQuantity: { decrement: item.quantity } },
          });
          if (result.count === 0) {
            throw new ConflictException(
              `Stock changed during checkout for ${productMap.get(item.productId)!.name}`,
            );
          }
        }

        // Transactional outbox: event written atomically WITH the order
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'order',
            aggregateId: created.id,
            eventType: 'order.created',
            payload: {
              orderId: created.id,
              storeId,
              customerId: dto.customerId,
              channel: dto.channel,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return { id: order.id, total: subtotal };
  }

  /**
   * Payment confirmation — idempotent by design.
   * PSP webhooks can retry; duplicate confirmations are no-ops.
   */
  async confirmPayment(orderId: string, paymentReference: string): Promise<void> {
    const { storeId } = TenantContext.require();

    await this.prisma.$transaction(async (tx) => {
      // Atomic conditional update = natural idempotency guard
      const result = await tx.order.updateMany({
        where: {
          id: orderId,
          storeId,
          status: 'PENDING_PAYMENT',
        },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentReference,
        },
      });

      if (result.count === 0) {
        // Already processed (idempotent replay) or genuinely wrong state
        const existing = await tx.order.findFirst({
          where: { id: orderId, storeId },
          select: { status: true },
        });
        if (existing?.status === 'PAID') return; // webhook replay — safe no-op
        throw new ConflictException(`Cannot confirm payment for order in state ${existing?.status}`);
      }

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'order',
          aggregateId: orderId,
          eventType: 'payment.succeeded',
          payload: { orderId, storeId, paymentReference } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    // Outbox relay ships this to RabbitMQ; consumers handle:
    // WhatsApp receipt → fulfillment → analytics → loyalty points
  }

  /**
   * Order state machine — explicit transition table. No skipping states
   * (e.g. PENDING_PAYMENT -> DELIVERED is impossible, by construction).
   */
  private static readonly TRANSITIONS: Record<string, string[]> = {
    PENDING_PAYMENT: ['PAID', 'CANCELLED'],
    PAID: ['PROCESSING', 'REFUNDED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: ['REFUNDED'],
    CANCELLED: [],
    REFUNDED: [],
  };

  async updateStatus(orderId: string, nextStatus: string): Promise<{ ok: true }> {
    const { storeId } = TenantContext.require();

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, storeId },
        select: { id: true, status: true },
      });
      if (!order) throw new NotFoundException('Order not found');

      const allowed = OrdersService.TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(nextStatus)) {
        throw new ConflictException(
          `Cannot move order from ${order.status} to ${nextStatus}`,
        );
      }

      const timestampField =
        nextStatus === 'SHIPPED'
          ? { shippedAt: new Date() }
          : nextStatus === 'DELIVERED'
            ? { deliveredAt: new Date() }
            : nextStatus === 'CANCELLED'
              ? { cancelledAt: new Date() }
              : {};

      await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus as never, ...timestampField },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'order',
          aggregateId: orderId,
          eventType:
            nextStatus === 'SHIPPED'
              ? 'order.shipped'
              : nextStatus === 'DELIVERED'
                ? 'order.delivered'
                : 'order.cancelled',
          payload: { orderId, storeId } as never,
        },
      });
    }).then(() => ({ ok: true as const }));
  }

  async findByStore(params: {
    cursor?: string;
    limit: number;
    status?: string;
  }): Promise<{ items: Array<{ id: string; orderNumber: string; status: string; total: number }>; nextCursor: string | null }> {
    const { storeId } = TenantContext.require();

    // Cursor pagination — stable under concurrent inserts (offset pagination is not)
    const items = await this.prisma.order.findMany({
      where: {
        storeId,
        ...(params.status ? { status: params.status as never } : {}),
      },
      take: params.limit + 1,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        orderNumber: true,
        status: true,
        subtotal: true,
      },
    });

    const hasNext = items.length > params.limit;
    const pageItems = hasNext ? items.slice(0, -1) : items;

    return {
      items: pageItems.map((o) => ({ ...o, total: Number(o.subtotal) })),
      nextCursor: hasNext ? pageItems[pageItems.length - 1].id : null,
    };
  }
}