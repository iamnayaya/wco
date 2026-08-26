import { Module } from '@nestjs/common';
import { ProductRecommendationsService } from './product-recommendations.service';

@Module({
  providers: [ProductRecommendationsService],
  exports: [ProductRecommendationsService],
})
export class ProductRecommendationsModule {}
