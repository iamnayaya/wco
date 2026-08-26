import { z } from 'zod';

/**
 * Payment Refund DTOs — validation for refund management endpoints.
 *
 * Supports full and partial refunds. Each refund is linked to a payment
 * and optionally an order. Refund processing goes through the PSP.
 */

const moneyAmount = z.number().positive().max(100_000_000);

// --- params ----------------------------------------------------------------

export const paymentIdParam = z.object({ id: z.string().min(1) });

export const refundIdParam = z.object({
  id: z.string().min(1),
  refundId: z.string().min(1),
});

// --- create ----------------------------------------------------------------

export const createRefundSchema = z.object({
  amount: moneyAmount.optional(), // omit for full refund
  reason: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// --- list ------------------------------------------------------------------

export const listRefundsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED']).optional(),
  sortBy: z.enum(['createdAt', 'amount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// --- types -----------------------------------------------------------------

export type CreateRefundDto = z.infer<typeof createRefundSchema>;
export type ListRefundsQuery = z.infer<typeof listRefundsQuerySchema>;
