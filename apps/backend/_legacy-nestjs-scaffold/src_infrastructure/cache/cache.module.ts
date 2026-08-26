import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService, REDIS_CLIENT } from './redis.service';

/**
 * CacheModule — global Redis wiring.
 * Single pooled connection per pod; ioredis handles reconnection internally.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () =>
        new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
          // Client-side caching would be enabled here in production
          // via RESP3 when ElastiCache supports it.
        }),
    },
    RedisService,
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class CacheModule {}
