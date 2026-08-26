import { z } from 'zod';

/**
 * Delivery Provider DTOs — validation for platform delivery provider management.
 */

export const deliveryProviderIdParams = z.object({ id: z.string().min(1) });

export const createDeliveryProviderSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  countries: z.array(z.string().min(2).max(3)).min(1).default(['NG']),
  cities: z.array(z.string().max(50)).default([]),
  baseFee: z.number().min(0).max(10_000_000),
  perKmFee: z.number().min(0).max(100_000).default(0),
  avgEtaMinutes: z.number().int().min(0).max(1440).optional(),
  webhookSecret: z.string().min(16).max(200).optional(),
  isActive: z.boolean().default(true),
  meta: z.record(z.string(), z.unknown()).default({}),
});

export const updateDeliveryProviderSchema = createDeliveryProviderSchema.partial().omit({ code: true });

export const listDeliveryProvidersQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  country: z.string().min(2).max(3).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const availableProvidersQuerySchema = z.object({
  pickupAddress: z.string().min(5).max(500),
  dropoffAddress: z.string().min(5).max(500),
  weight: z.coerce.number().positive().max(1000).optional(),
  length: z.coerce.number().positive().max(500).optional(),
  width: z.coerce.number().positive().max(500).optional(),
  height: z.coerce.number().positive().max(500).optional(),
});

export type CreateDeliveryProviderDto = z.infer<typeof createDeliveryProviderSchema>;
export type UpdateDeliveryProviderDto = z.infer<typeof updateDeliveryProviderSchema>;
export type ListDeliveryProvidersQuery = z.infer<typeof listDeliveryProvidersQuerySchema>;
export type AvailableProvidersQuery = z.infer<typeof availableProvidersQuerySchema>;
