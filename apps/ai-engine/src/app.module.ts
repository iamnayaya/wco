import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';

// AI services (provider abstraction layer) — global, single instances
import { AiServicesModule } from './services/services.module';

// Feature modules
import { AutoResponderModule } from './modules/auto-responder/auto-responder.module';
import { PricingOptimizerModule } from './modules/pricing-optimizer/pricing-optimizer.module';
import { SentimentAnalysisModule } from './modules/sentiment-analysis/sentiment-analysis.module';
import { DemandForecastingModule } from './modules/demand-forecasting/demand-forecasting.module';
import { CustomerSegmentationModule } from './modules/customer-segmentation/customer-segmentation.module';
import { ProductRecommendationsModule } from './modules/product-recommendations/product-recommendations.module';
import { ContentGenerationModule } from './modules/content-generation/content-generation.module';

// Queue consumers — the actual traffic entrypoints
import { ConsumersModule } from './consumers/consumers.module';

@Module({
  imports: [
    // Fail-fast config validation
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    TerminusModule,
    AiServicesModule,

    AutoResponderModule,
    PricingOptimizerModule,
    SentimentAnalysisModule,
    DemandForecastingModule,
    CustomerSegmentationModule,
    ProductRecommendationsModule,
    ContentGenerationModule,
    ConsumersModule,
  ],
})
export class AppModule {}

function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const required = ['REDIS_URL', 'RABBITMQ_URL'] as const;
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`AI Engine missing env vars: ${missing.join(', ')}`);
  }
  if (!config.CLAUDE_API_KEY && !config.OPENAI_API_KEY) {
    throw new Error('At least one of CLAUDE_API_KEY / OPENAI_API_KEY is required');
  }
  return config;
}
