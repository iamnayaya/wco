import { z } from 'zod';

/**
 * Delivery Tracking DTOs — validation for tracking event management.
 */

export const trackingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const createTrackingEventSchema = z.object({
  status: z.enum(['QUOTED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED']),
  location: z.string().max(300).optional(),
  note: z.string().max(500).optional(),
  source: z.enum(['system', 'webhook', 'polling', 'manual']).default('manual'),
  occurredAt: z.coerce.string().datetime().optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
});

export type CreateTrackingEventDto = z.infer<typeof createTrackingEventSchema>;
