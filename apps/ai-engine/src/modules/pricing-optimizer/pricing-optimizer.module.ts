import { Module } from '@nestjs/common';
import { PricingOptimizerService } from './pricing-optimizer.service';

@Module({
  providers: [PricingOptimizerService],
  exports: [PricingOptimizerService],
})
export class PricingOptimizerModule {}
