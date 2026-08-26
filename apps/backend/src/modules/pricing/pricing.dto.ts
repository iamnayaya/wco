import { z } from 'zod';

/** Pricing DTOs - AI price suggestion review flow. */

export const listSuggestionsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'DISMISSED', 'EXPIRED']).default('PENDING'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const idParams = z.object({ id: z.string().min(1) });

export type ListSuggestionsQueryDto = z.infer<typeof listSuggestionsQuerySchema>;
