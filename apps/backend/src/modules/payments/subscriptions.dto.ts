import { z } from 'zod';

/**
 * Subscription DTOs — validation for merchant subscription management.
 *
 * Subscriptions tie merchants to billing plans with lifecycle states
 * (TRIALING, ACTIVE, PAST_DUE, PAUSED, CANCELLED, EXPIRED).
 */

const moneyAmount = z.number().positive().max(100_000_000);

// --- create ----------------------------------------------------------------

export const createSubscriptionSchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
  paymentMethodId: z.string().min(1).optional(),
});

// --- update ----------------------------------------------------------------

export const updateSubscriptionSchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
  paymentMethodId: z.string().min(1).optional(),
});

// --- upgrade/downgrade ------------------------------------------------------

export const changePlanSchema = z.object({
  planId: z.string().min(1),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
});

// --- renew ------------------------------------------------------------------

export const renewSubscriptionSchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
});

// --- cancel -----------------------------------------------------------------

export const cancelSubscriptionSchema = z.object({
  reason: z.string().max(500).optional(),
  cancelAtPeriodEnd: z.boolean().default(true),
});

// --- types -----------------------------------------------------------------

export type CreateSubscriptionDto = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionDto = z.infer<typeof updateSubscriptionSchema>;
export type ChangePlanDto = z.infer<typeof changePlanSchema>;
export type CancelSubscriptionDto = z.infer<typeof cancelSubscriptionSchema>;
