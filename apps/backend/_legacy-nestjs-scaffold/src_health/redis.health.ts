import { HealthIndicator, HealthIndicatorResult, type HealthCheckError } from '@nestjs/terminus';
import type Redis from 'ioredis';

/**
 * RedisHealthIndicator — PING with a tight timeout; a slow cache must not
 * wedge the readiness probe.
 */
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const result = await Promise.race([
        this.redis.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
      ]);
      return this.getStatus(key, result === 'PONG');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      throw {
        [key]: { status: 'down', message },
      } satisfies HealthCheckError;
    }
  }
}
