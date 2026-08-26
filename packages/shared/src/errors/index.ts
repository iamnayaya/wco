/**
 * Typed application error hierarchy.
 *
 * Contract: every error crossing the API boundary carries a stable `code`
 * (machine-readable) + human message. The GlobalExceptionFilter maps these to
 * HTTP status codes; unknown errors become 500 with internals stripped.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'TENANT_MISMATCH'
  | 'INSUFFICIENT_STOCK'
  | 'PAYMENT_FAILED'
  | 'PROVIDER_UNAVAILABLE'
  | 'IDEMPOTENCY_REPLAY'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  TENANT_MISMATCH: 403,
  INSUFFICIENT_STOCK: 409,
  PAYMENT_FAILED: 402,
  PROVIDER_UNAVAILABLE: 503,
  IDEMPOTENCY_REPLAY: 200,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super('FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super('CONFLICT', message);
  }
}

export class InsufficientStockError extends AppError {
  constructor(productName: string) {
    super('INSUFFICIENT_STOCK', `Insufficient stock for ${productName}`);
  }
}

export class PaymentFailedError extends AppError {
  constructor(reason: string) {
    super('PAYMENT_FAILED', reason);
  }
}
