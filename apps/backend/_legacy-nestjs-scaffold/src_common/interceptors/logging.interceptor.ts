import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * LoggingInterceptor — structured request/response logging with latency.
 * Pino redacts auth headers; bodies are logged at debug only.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<FastifyReply>();
          this.logger.log({
            method: request.method,
            url: request.url,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
            userId: request.user?.id,
          });
        },
        error: (error: unknown) => {
          this.logger.warn({ method: request.url, durationMs: Date.now() - startedAt, error: String(error) });
        },
      }),
    );
  }
}
