import { EVENT_TYPES } from '@wco/shared';
import { z } from 'zod';

/**
 * Outbound webhook subscription DTOs (WCO -> merchant systems).
 *
 * Inbound provider webhooks (WhatsApp/Paystack/GIG -> WCO) are handled by the
 * dedicated apps/webhook-handler service; this module manages the reverse
 * direction. Secrets are shown ONCE at creation, then only ever masked.
 */

export const createSubscriptionSchema = z.object({
  url: z.string().url().max(500),
  /** Empty/omitted = all events. Values must match the shared event catalog. */
  events: z.array(z.enum(EVENT_TYPES)).max(50).default([]),
});

export const updateSubscriptionSchema = z.object({
  url: z.string().url().max(500).optional(),
  events: z.array(z.enum(EVENT_TYPES)).max(50).optional(),
  isActive: z.boolean().optional(),
});

export const idParams = z.object({ id: z.string().min(1) });

export type CreateSubscriptionDto = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionDto = z.infer<typeof updateSubscriptionSchema>;

/** Public projection - secret masked to first4...last4. */
export interface SubscriptionView {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  secretMasked: string;
  createdAt: Date;
}

export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}
