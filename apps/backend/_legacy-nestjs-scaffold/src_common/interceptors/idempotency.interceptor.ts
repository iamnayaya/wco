import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Observable, firstValueFrom, of } from 'rxjs';
import { RedisService } from '../../infrastructure/cache/redis.service';

/**
 * IdempotencyInterceptor — safe retries for POST money-movement endpoints.
 *
 * Contract:
 *  - Client sends `X-Idempotency-Key` (uuid). Same key + same merchant returns
 *    the ORIGINAL response for 24h without re-executing the handler.
 *  - Errors are never cached: a failed attempt is always retryable.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();

    if (request.method !== 'POST') return next.handle();

    const idempotencyKey = request.headers['x-idempotency-key'] as string | undefined;
    const user = request.user as { sub?: string } | undefined;
    if (!idempotencyKey || !user?.sub) return next.handle();

    // Scope key to principal + route so keys can never collide across tenants
    const key = `idem:${user.sub}:${request.url}:${idempotencyKey}`;

    const cached = await this.redis.getIdempotentResponse(key);
    if (cached) {
      void response.status(cached.status).header('X-Idempotent-Replay', 'true');
      return of(cached.body);
    }

    const result = await firstValueFrom(next.handle());
    await this.redis.setIdempotentResponse(key, response.statusCode ?? 201, result);
    return of(result);
  }
}
