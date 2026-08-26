import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';

// Infrastructure modules
import { DatabaseModule } from '@wco/database';
import { AuthModule } from '@wco/auth';

// Feature modules (bounded contexts)
import { AuthModule as ApiAuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StoresModule } from './modules/stores/stores.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { LogisticsModule } from './modules/logistics/logistics.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Configuration — validated at boot, fails fast on bad config
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      expandVariables: true,
    }),

    // Observability
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            '*.password',
            '*.token',
            '*.apiKey',
          ],
          censor: '[REDACTED]',
        },
        customProps: () => ({ service: 'wco-backend' }),
      },
    }),

    // Rate limiting: global default + per-route overrides
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),

    ScheduleModule.forRoot(),
    TerminusModule,

    // Infrastructure
    DatabaseModule,
    AuthModule,

    // Bounded contexts
    ApiAuthModule,
    UsersModule,
    StoresModule,
    ProductsModule,
    OrdersModule,
    CustomersModule,
    PaymentsModule,
    LogisticsModule,
    MessagingModule,
    AnalyticsModule,
    MarketingModule,
    PricingModule,
    NotificationsModule,
    WebhooksModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

/**
 * Fail-fast environment validation.
 * The app must never boot with invalid config in production.
 */
function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const required = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'] as const;

  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = String(config.JWT_SECRET);
    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
  }

  return config;
}