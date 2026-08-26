import { z } from 'zod';

/** Admin DTOs - platform operations reads. */

export const listMerchantsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
