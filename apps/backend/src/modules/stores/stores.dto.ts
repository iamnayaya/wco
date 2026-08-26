import { z } from 'zod';

/** Store DTOs - the merchant's commerce locations. */

export const storeBodySchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  whatsappNumber: z.string().max(20).optional(),
  currency: z.enum(['NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'USD']).optional(),
  timezone: z.string().max(64).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  country: z.enum(['NG', 'GH', 'KE']).default('NG'),
});

export const idParams = z.object({ id: z.string().min(1) });

export type StoreBodyDto = z.infer<typeof storeBodySchema>;
export type IdParams = z.infer<typeof idParams>;
