import { z } from 'zod';

/** Logistics DTOs - carrier quotes, booking, tracking. */

export const quoteSchema = z.object({
  pickupAddress: z.string().min(5).max(500),
  dropoffAddress: z.string().min(5).max(500),
  recipientName: z.string().max(120).optional(),
  recipientPhone: z.string().min(7).max(20),
  packageName: z.string().max(200).optional(),
  packageWeightKg: z.number().positive().max(1000).optional(),
});

export const quoteQuerySchema = z.object({
  carrier: z.enum(['GIG', 'KWIK', 'SENDY']).optional(),
});

export const orderIdParams = z.object({ orderId: z.string().min(1) });
export const idParams = z.object({ id: z.string().min(1) });

export type QuoteDto = z.infer<typeof quoteSchema>;
