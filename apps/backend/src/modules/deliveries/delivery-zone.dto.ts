import { z } from 'zod';

/**
 * Delivery Zone DTOs — validation for delivery zone management.
 */

export const deliveryZoneIdParams = z.object({ id: z.string().min(1) });

export const createDeliveryZoneSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['CITY', 'STATE', 'COUNTRY', 'RADIUS', 'CUSTOM']).default('CUSTOM'),
  coordinates: z.array(z.array(z.number())).min(1),
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  radiusKm: z.number().positive().max(500).optional(),
  fee: z.number().min(0).max(10_000_000).default(0),
  etaMinutes: z.number().int().min(0).max(1440).optional(),
  isActive: z.boolean().default(true),
  meta: z.record(z.string(), z.unknown()).default({}),
});

export const updateDeliveryZoneSchema = createDeliveryZoneSchema.partial();

export const listDeliveryZonesQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const checkAddressInZoneSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(500).optional(),
});

export type CreateDeliveryZoneDto = z.infer<typeof createDeliveryZoneSchema>;
export type UpdateDeliveryZoneDto = z.infer<typeof updateDeliveryZoneSchema>;
