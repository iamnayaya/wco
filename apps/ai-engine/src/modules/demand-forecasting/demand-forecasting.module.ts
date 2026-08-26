import { Module } from '@nestjs/common';
import { DemandForecastingService } from './demand-forecasting.service';

@Module({
  providers: [DemandForecastingService],
  exports: [DemandForecastingService],
})
export class DemandForecastingModule {}
