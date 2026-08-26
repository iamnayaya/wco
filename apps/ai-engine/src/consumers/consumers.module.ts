import { Global, Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { AiConsumers } from './ai-consumers.service';
import { AutoResponderModule } from '../modules/auto-responder/auto-responder.module';
import { PricingOptimizerModule } from '../modules/pricing-optimizer/pricing-optimizer.module';
import { DemandForecastingModule } from '../modules/demand-forecasting/demand-forecasting.module';
import { CustomerSegmentationModule } from '../modules/customer-segmentation/customer-segmentation.module';

/**
 * ConsumersModule — wires queue subscriptions to AI modules.
 * DatabaseModule is global (provided by @wco/database).
 */
@Global()
@Module({
  imports: [
    AutoResponderModule,
    PricingOptimizerModule,
    DemandForecastingModule,
    CustomerSegmentationModule,
  ],
  providers: [
    {
      provide: RabbitMQService,
      useFactory: () => new RabbitMQService(process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'),
    },
    AiConsumers,
  ],
  exports: [RabbitMQService],
})
export class ConsumersModule {}
