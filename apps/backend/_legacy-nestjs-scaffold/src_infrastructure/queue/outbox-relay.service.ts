import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry, Interval } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '@wco/database';
import { RabbitMQService } from './rabbitmq.service';
import { OrdersEventPublisher } from '../../modules/orders/orders.event-publisher';

/**
 * OutboxRelay — the ONLY bridge between Postgres and RabbitMQ for business
 * events. Runs every 500ms on every pod; SKIP LOCKED claim semantics make
 * concurrent pods pick disjoint batches.
 *
 * Publish-then-delete inside one DB transaction:
 *   - publish throws  -> transaction rolls back -> rows retried next tick
 *   - crash mid-tick  -> rows never deleted    -> redelivered (at-least-once)
 */
@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
  private readonly batchSize = 100;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMQService,
    private readonly publisher: OrdersEventPublisher,
    private readonly logger: Logger,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const interval = setInterval(() => void this.relayOnce(), 500);
    this.scheduler.addInterval('outbox-relay', interval);
  }

  onModuleDestroy(): void {
    clearInterval(this.scheduler.getInterval('outbox-relay'));
  }

  @Interval(500)
  async relayOnce(): Promise<void> {
    if (this.running) return; // single-flight per pod
    this.running = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string; eventType: string; payload: unknown }>
        >`
          SELECT id, event_type AS "eventType", payload
          FROM outbox_events
          WHERE processed_at IS NULL
          ORDER BY created_at
          LIMIT ${this.batchSize}
          FOR UPDATE SKIP LOCKED
        `;
        if (rows.length === 0) return;

        for (const row of rows) {
          // Broker publish is buffered & persistent — failures throw and
          // roll the whole batch back for retry.
          await this.rabbitmq.publish(row.eventType, row.payload as object);
        }
        await tx.outboxEvent.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });

        if (rows.length === this.batchSize) {
          this.logger.warn(`Outbox saturated (${rows.length} events/tick) — consider scaling workers`);
        }
      });
    } catch (error) {
      this.logger.error({ err: error }, 'outbox relay tick failed');
    } finally {
      this.running = false;
    }
  }
}
