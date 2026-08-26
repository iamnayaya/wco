import { z } from 'zod';

/**
 * Subscription Plan DTOs — validation for platform plan management.
 *
 * Plans define pricing tiers (FREE, STARTER, GROWTH, SCALE) with
 * feature limits, pricing, and trial configuration.
 */

export const subscriptionPlanIdParams = z.object({ id: z.string().min(1) });

export const createSubscriptionPlanSchema = z.object({
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

export const updateSubscriptionPlanSchema = createSubscriptionPlanSchema.partial();

export const listSubscriptionPlansQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const planSlugParams = z.object({ slug: z.string().min(1) });

export type CreateSubscriptionPlanDto = z.infer<typeof createSubscriptionPlanSchema>;
export type UpdateSubscriptionPlanDto = z.infer<typeof updateSubscriptionPlanSchema>;
