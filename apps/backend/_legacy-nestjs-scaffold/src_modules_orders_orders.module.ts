import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersEventPublisher } from './orders.event-publisher';
import { OrdersRepository } from './orders.repository';

/**
 * OrdersModule — bounded context for order lifecycle.
 *
 * Exports service for cross-context use (Payments, Logistics, Marketing).
 * Queue registration for async side-effect processing.
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'order-fulfillment' },
      { name: 'notifications' },
    ),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository, OrdersEventPublisher],
  exports: [OrdersService],
})
export class OrdersModule {}