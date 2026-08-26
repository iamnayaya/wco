import { z } from 'zod';

/**
 * Payment DTOs — comprehensive validation for all payment endpoints.
 *
 * Conventions:
 * - All amounts in MAJOR units (naira, cedi, shilling)
 * - providerReference is the PSP's unique transaction id
 * - Date ranges use ISO 8601 strings
 * - Offset pagination (page/pageSize) for list endpoints
 */

// --- primitives -----------------------------------------------------------

const moneyAmount = z.number().positive().max(100_000_000);
const phoneE164 = z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Phone must be E.164-ish');
const sortOrder = z.enum(['asc', 'desc']).default('desc');

// --- id params ------------------------------------------------------------

export const idParams = z.object({ id: z.string().min(1) });

export const paymentIdParams = z.object({
  id: z.string().min(1),
  refundId: z.string().min(1).optional(),
});

// --- payment initialization ------------------------------------------------

export const initializePaymentSchema = z.object({
  orderId: z.string().min(1),
  provider: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'OPAY']),
});

// --- payment send (direct, no order context) --------------------------------

export const sendPaymentSchema = z.object({
  recipientPhone: phoneE164,
  amount: moneyAmount,
  currency: z.enum(['NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'USD']).default('NGN'),
  provider: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'OPAY']),
  description: z.string().max(280).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  conversationId: z.string().min(1).optional(),
});

// --- refund ----------------------------------------------------------------

export const refundSchema = z.object({
  amount: moneyAmount.optional(),
  reason: z.string().max(500).optional(),
});

export const refundListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED']).optional(),
  sortBy: z.enum(['createdAt', 'amount']).default('createdAt'),
  sortOrder,
});

// --- list / search / export ------------------------------------------------

export const listPaymentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(255).optional(),
});

export const listPaymentsOffsetSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['INITIALIZED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'ABANDONED']).optional(),
  provider: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'OPAY', 'BANK_TRANSFER', 'CASH']).optional(),
  orderId: z.string().min(1).optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'amount', 'paidAt']).default('createdAt'),
  sortOrder,
});

export const searchPaymentsSchema = z.object({
  q: z.string().min(2).max(200),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const exportPaymentsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(['INITIALIZED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'ABANDONED']).optional(),
  provider: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'OPAY', 'BANK_TRANSFER', 'CASH']).optional(),
  format: z.enum(['csv', 'json']).default('csv'),
});

// --- payment link generation -----------------------------------------------

export const generatePaymentLinkSchema = z.object({
  amount: moneyAmount,
  currency: z.enum(['NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'USD']).default('NGN'),
  provider: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'OPAY']),
  customerPhone: phoneE164.optional(),
  customerEmail: z.string().email().optional(),
  description: z.string().max(280).optional(),
  expiresInMinutes: z.number().int().min(5).max(10080).default(1440), // 1 day default, max 7 days
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// --- payment stats ---------------------------------------------------------

export const paymentStatsSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

// --- webhook inbound -------------------------------------------------------

export const webhookProviderParams = z.object({
  provider: z.enum(['paystack', 'flutterwave', 'opay']),
});

// --- commissions & fees -----------------------------------------------------

export const listCommissionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'SETTLED', 'CANCELLED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const listFeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(['PROCESSING', 'PLATFORM', 'CURRENCY_CONVERSION', 'REFUND']).optional(),
  status: z.enum(['PENDING', 'CHARGED', 'REFUNDED', 'WAIVED']).optional(),
});

// --- fraud detection --------------------------------------------------------

export const fraudAnalyzeSchema = z.object({
  amount: z.number().positive().max(100_000_000),
  currency: z.enum(['NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'USD']).default('NGN'),
  provider: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'OPAY', 'BANK_TRANSFER', 'CASH']),
  customerPhone: z.string().regex(/^\+?[1-9]\d{7,14}$/).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const flaggedPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// --- subscription (admin plans) -------------------------------------------

export const subscriptionPlanCreateSchema = z.object({
  code: z.enum(['FREE', 'STARTER', 'GROWTH', 'SCALE']),
  name: z.string().min(1).max(60),
  description: z.string().max(500).optional(),
  priceMonthly: z.number().min(0).max(10_000_000),
  priceYearly: z.number().min(0).max(100_000_000),
  currency: z.enum(['NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'USD']).default('NGN'),
  trialDays: z.number().int().min(0).max(365).default(0),
  limits: z.record(z.string(), z.unknown()).default({}),
  features: z.array(z.string().max(200)).max(50).default([]),
  sortOrder: z.number().int().min(0).default(0),
});

export const subscriptionPlanUpdateSchema = subscriptionPlanCreateSchema.partial();

// --- types -----------------------------------------------------------------

export type InitializePaymentDto = z.infer<typeof initializePaymentSchema>;
export type RefundDto = z.infer<typeof refundSchema>;
export type SendPaymentDto = z.infer<typeof sendPaymentSchema>;
export type ListPaymentsOffsetQuery = z.infer<typeof listPaymentsOffsetSchema>;
export type SearchPaymentsQuery = z.infer<typeof searchPaymentsSchema>;
export type ExportPaymentsQuery = z.infer<typeof exportPaymentsSchema>;
export type GeneratePaymentLinkDto = z.infer<typeof generatePaymentLinkSchema>;
export type PaymentStatsQuery = z.infer<typeof paymentStatsSchema>;
export type ListCommissionsQuery = z.infer<typeof listCommissionsQuerySchema>;
export type ListFeesQuery = z.infer<typeof listFeesQuerySchema>;
export type FraudAnalyzeDto = z.infer<typeof fraudAnalyzeSchema>;
