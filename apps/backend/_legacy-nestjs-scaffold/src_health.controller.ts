import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '@wco/database';
import { RedisHealthIndicator } from './health/redis.health';
import { RabbitMQHealthIndicator } from './health/rabbitmq.health';

@ApiTags('system')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly rabbitmq: RabbitMQHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness + readiness probe (used by K8s & ALB)' })
  check() {
    return this.health.check([
      // Database connectivity
      () => this.prismaHealth.pingCheck('postgres', this.prisma, { timeout: 2000 }),
      // Cache connectivity
      () => this.redis.isHealthy('redis'),
      // Queue connectivity
      () => this.rabbitmq.isHealthy('rabbitmq'),
      // Memory heap must stay under 300MB (pod limit 512MB headroom)
      () => this.memory.checkHeap('memory-heap', 300 * 1024 * 1024),
      // Disk usage under 90%
      () =>
        this.disk.checkStorage('storage', { thresholdPercent: 0.9, path: '/' }),
    ]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness only — is the process alive' })
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}