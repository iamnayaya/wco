import { Module } from '@nestjs/common';
import { CustomerSegmentationService } from './customer-segmentation.service';

@Module({
  providers: [CustomerSegmentationService],
  exports: [CustomerSegmentationService],
})
export class CustomerSegmentationModule {}
