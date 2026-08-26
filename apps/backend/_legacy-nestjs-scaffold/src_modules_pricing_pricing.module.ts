import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { QueueModule } from '../../infrastructure/queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [PricingController],
  providers: [PricingService],
})
export class PricingModule {}
