import { z } from 'zod';

/**
 * Payment Method DTOs — validation for merchant payout account management.
 *
 * Payment methods represent where settled money lands (bank accounts, mobile
 * money wallets). Account numbers are encrypted at the application layer;
 * only last-4 digits and hashes are stored in plaintext.
 */

const phoneE164 = z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Phone must be E.164-ish');

// --- params ----------------------------------------------------------------

export const paymentMethodIdParams = z.object({ id: z.string().min(1) });

// --- create ----------------------------------------------------------------

export const createPaymentMethodSchema = z.object({
  type: z.enum(['BANK_ACCOUNT', 'MOBILE_MONEY', 'USSD', 'CARD']),
  providerName: z.string().min(1).max(100), // "GTBank" | "OPay" | "M-Pesa" | "MTN MoMo"
  accountName: z.string().min(1).max(200),
  accountNumber: z.string().min(6).max(20), // will be encrypted before storage
  bankCode: z.string().max(20).optional(),
  isDefault: z.boolean().default(false),
  meta: z.record(z.string(), z.unknown()).default({}),
});

// --- update ----------------------------------------------------------------

export const updatePaymentMethodSchema = createPaymentMethodSchema.partial().omit({ accountNumber: true });

// --- list ------------------------------------------------------------------

export const listPaymentMethodsQuerySchema = z.object({
  type: z.enum(['BANK_ACCOUNT', 'MOBILE_MONEY', 'USSD', 'CARD']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// --- types -----------------------------------------------------------------

export type CreatePaymentMethodDto = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodDto = z.infer<typeof updatePaymentMethodSchema>;
export type ListPaymentMethodsQuery = z.infer<typeof listPaymentMethodsQuerySchema>;
