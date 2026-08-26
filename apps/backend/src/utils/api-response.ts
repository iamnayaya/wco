/**
 * Canonical API response envelope.
 *
 * Success: { success: true, data, meta? }
 * Failure: { success: false, error: { code, message, details? }, requestId? }
 *
 * A single shape lets web/mobile clients implement ONE interceptor and keeps
 * OpenAPI examples consistent across every endpoint.
 */

export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface CursorMeta {
  readonly nextCursor: string | null;
}

export interface ApiMeta {
  readonly requestId?: string;
  readonly pagination?: PaginationMeta | CursorMeta;
  readonly [key: string]: unknown;
}

export function sendSuccess<T>(
  res: import('express').Response,
  data: T,
  meta?: ApiMeta,
  statusCode = 200,
): void {
  res.status(statusCode).json(meta ? { success: true, data, meta } : { success: true, data });
}
