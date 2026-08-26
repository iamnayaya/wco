import { z } from 'zod';

/**
 * Delivery DTOs — validation for delivery lifecycle management.
 */

export const deliveryIdParams = z.object({ id: z.string().min(1) });

export const orderIdParams = z.object({ orderId: z.string().min(1) });

export const createDeliverySchema = z.object({
  orderId: z.string().min(1),
  deliveryProviderId: z.string().optional(),
  carrier: z.enum(['GIG', 'KWIK', 'SENDY', 'MANUAL']).default('MANUAL'),
  pickupAddress: z.string().min(5).max(500),
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  dropoffAddress: z.string().min(5).max(500),
  dropoffLat: z.number().min(-90).max(90).optional(),
  dropoffLng: z.number().min(-180).max(180).optional(),
  recipientName: z.string().max(120).optional(),
  recipientPhone: z.string().min(7).max(20),
  packageDescription: z.string().max(500).optional(),
  packageWeightKg: z.number().positive().max(1000).optional(),
  packageLengthCm: z.number().positive().max(500).optional(),
  packageWidthCm: z.number().positive().max(500).optional(),
  packageHeightCm: z.number().positive().max(500).optional(),
  insuranceAmount: z.number().min(0).max(10_000_000).optional(),
  codAmount: z.number().min(0).max(10_000_000).optional(),
  meta: z.record(z.string(), z.unknown()).default({}),
});

export const updateDeliverySchema = z.object({
  deliveryProviderId: z.string().optional(),
  carrier: z.enum(['GIG', 'KWIK', 'SENDY', 'MANUAL']).optional(),
  pickupAddress: z.string().min(5).max(500).optional(),
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  dropoffAddress: z.string().min(5).max(500).optional(),
  dropoffLat: z.number().min(-90).max(90).optional(),
  dropoffLng: z.number().min(-180).max(180).optional(),
  recipientName: z.string().max(120).optional(),
  recipientPhone: z.string().min(7).max(20).optional(),
  packageDescription: z.string().max(500).optional(),
  packageWeightKg: z.number().positive().max(1000).optional(),
  packageLengthCm: z.number().positive().max(500).optional(),
  packageWidthCm: z.number().positive().max(500).optional(),
  packageHeightCm: z.number().positive().max(500).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const listDeliveriesQuerySchema = z.object({
  status: z.enum(['QUOTED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED']).optional(),
  carrier: z.enum(['GIG', 'KWIK', 'SENDY', 'MANUAL']).optional(),
  from: z.coerce.string().datetime().optional(),
  to: z.coerce.string().datetime().optional(),
  q: z.string().min(2).max(100).optional(),
  sortBy: z.enum(['createdAt', 'status', 'fee', 'etaMinutes']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const calculateCostSchema = z.object({
  pickupAddress: z.string().min(5).max(500),
  dropoffAddress: z.string().min(5).max(500),
  weight: z.number().positive().max(1000).optional(),
  length: z.number().positive().max(500).optional(),
  width: z.number().positive().max(500).optional(),
  height: z.number().positive().max(500).optional(),
  carrier: z.enum(['GIG', 'KWIK', 'SENDY']).optional(),
  insuranceAmount: z.number().min(0).optional(),
});

export const exportDeliveriesSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  status: z.enum(['QUOTED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED']).optional(),
  carrier: z.enum(['GIG', 'KWIK', 'SENDY', 'MANUAL']).optional(),
  from: z.coerce.string().datetime().optional(),
  to: z.coerce.string().datetime().optional(),
});

export const deliveryStatsQuerySchema = z.object({
  from: z.coerce.string().datetime().optional(),
  to: z.coerce.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

export const cancelDeliverySchema = z.object({
  reason: z.string().max(500).optional(),
});

export const rateDeliverySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export type CreateDeliveryDto = z.infer<typeof createDeliverySchema>;
export type UpdateDeliveryDto = z.infer<typeof updateDeliverySchema>;
export type ListDeliveriesQuery = z.infer<typeof listDeliveriesQuerySchema>;
export type CalculateCostDto = z.infer<typeof calculateCostSchema>;
