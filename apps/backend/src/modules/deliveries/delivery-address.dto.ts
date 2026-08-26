import { z } from 'zod';

/**
 * Delivery Address DTOs — validation for saved delivery addresses.
 */

export const deliveryAddressIdParams = z.object({ id: z.string().min(1) });

export const createDeliveryAddressSchema = z.object({
  label: z.string().min(1).max(100),
  contactName: z.string().max(120).optional(),
  contactPhone: z.string().min(7).max(20).optional(),
  addressLine1: z.string().min(5).max(300),
  addressLine2: z.string().max(300).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  country: z.string().min(2).max(3).default('NG'),
  postalCode: z.string().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().default(false),
  meta: z.record(z.string(), z.unknown()).default({}),
});

export const updateDeliveryAddressSchema = createDeliveryAddressSchema.partial();

export const listDeliveryAddressesQuerySchema = z.object({
  city: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const validateAddressSchema = z.object({
  addressLine1: z.string().min(5).max(300),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  country: z.string().min(2).max(3).default('NG'),
});

export const geocodeAddressSchema = z.object({
  address: z.string().min(5).max(500),
});

export const reverseGeocodeSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type CreateDeliveryAddressDto = z.infer<typeof createDeliveryAddressSchema>;
export type UpdateDeliveryAddressDto = z.infer<typeof updateDeliveryAddressSchema>;
export type ListDeliveryAddressesQuery = z.infer<typeof listDeliveryAddressesQuerySchema>;
