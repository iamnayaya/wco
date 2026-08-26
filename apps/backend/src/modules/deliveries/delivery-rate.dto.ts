import { z } from 'zod';

/**
 * Delivery Rate DTOs — validation for delivery rate card management.
 */

export const deliveryRateIdParams = z.object({ id: z.string().min(1) });

export const deliveryProviderIdParam = z.object({ providerId: z.string().min(1) });

export const createDeliveryRateSchema = z.object({
  name: z.string().min(1).max(60),
  baseFee: z.number().min(0).max(10_000_000),
  perKmFee: z.number().min(0).max(100_000).default(0),
  perKgFee: z.number().min(0).max(100_000).default(0),
  minimumFee: z.number().min(0).max(10_000_000).default(0),
  maximumFee: z.number().min(0).max(10_000_000).optional(),
  freeThresholdKm: z.number().positive().max(1000).optional(),
  avgEtaMinutes: z.number().int().min(0).max(1440).optional(),
  maxWeightKg: z.number().positive().max(1000).optional(),
  maxDimensionsCm: z.number().positive().max(3000).optional(),
  isActive: z.boolean().default(true),
  meta: z.record(z.string(), z.unknown()).default({}),
});

export const updateDeliveryRateSchema = createDeliveryRateSchema.partial();

export const calculateRateSchema = z.object({
  pickupAddress: z.string().min(5).max(500),
  dropoffAddress: z.string().min(5).max(500),
  weight: z.number().positive().max(1000).optional(),
  length: z.number().positive().max(500).optional(),
  width: z.number().positive().max(500).optional(),
  height: z.number().positive().max(500).optional(),
});

export type CreateDeliveryRateDto = z.infer<typeof createDeliveryRateSchema>;
export type UpdateDeliveryRateDto = z.infer<typeof updateDeliveryRateSchema>;
export type CalculateRateDto = z.infer<typeof calculateRateSchema>;
