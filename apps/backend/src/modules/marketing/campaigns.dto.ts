import { CAMPAIGN_TYPES } from '@wco/shared';
import { z } from 'zod';

/** Campaign DTOs - bulk WhatsApp broadcasts with audience filters. */

export const audienceFilterSchema = z
  .object({
    tags: z.array(z.string().min(1).max(40)).max(10).optional(),
    segment: z.string().max(40).optional(),
    minOrders: z.number().int().min(0).optional(),
    marketingOptInOnly: z.boolean().default(true),
  })
  .default({ marketingOptInOnly: true });

export const createCampaignSchema = z.object({
  type: z.enum(CAMPAIGN_TYPES),
  name: z.string().min(1).max(120),
  messageBody: z.string().min(1).max(4096),
  audienceFilter: audienceFilterSchema,
  scheduledFor: z.coerce.date().optional(),
});

export const idParams = z.object({ id: z.string().min(1) });

export type AudienceFilterDto = z.infer<typeof audienceFilterSchema>;
export type CreateCampaignDto = z.infer<typeof createCampaignSchema>;
