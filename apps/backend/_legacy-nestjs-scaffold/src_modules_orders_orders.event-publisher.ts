import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@wco/database';
import type { EventType } from '@wco/shared';

export interface OutboxRow {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
}

/**
 * OrdersEventPublisher — transactional outbox writer.
 *
 * Domain events are inserted INTO Postgres inside the same transaction as
 * the state change (never published straight to RabbitMQ from here).
 * The OutboxRelay worker claims rows with FOR UPDATE SKIP LOCKED, publishes
 * them, then deletes — at-least-once delivery with no dual-write window.
 */
@Injectable()
export class OrdersEventPublisher {
  constructor(private readonly prisma: PrismaService) {}

  /** Write an event atomically inside a business transaction. */
  async emit(
    input: {
      aggregateType: 'order' | 'payment' | 'shipment';
      aggregateId: string;
      storeId: string;
      eventType: EventType;
      payload: Record<string, unknown>;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: { storeId: input.storeId, ...input.payload } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Claim a batch for publishing. SKIP LOCKED makes concurrent relays on
   * multiple pods pick disjoint batches without coordination.
   */
  async claimBatch(batchSize = 100): Promise<OutboxRow[]> {
    return this.prisma.$queryRaw<OutboxRow[]>`
      SELECT id, event_type AS "eventType", aggregate_type AS "aggregateType",
             aggregate_id AS "aggregateId", payload
      FROM outbox_events
      WHERE processed_at IS NULL AND created_at < now() - interval '2 seconds'
      ORDER BY created_at
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `;
  }

  /** Called only AFTER successful broker publish. */
  async markProcessed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prisma.outboxEvent.deleteMany({ where: { id: { in: ids } } });
  }
}
