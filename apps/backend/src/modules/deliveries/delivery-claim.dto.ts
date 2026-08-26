import { z } from 'zod';

/**
 * Delivery Claim DTOs — validation for delivery claim management.
 */

export const deliveryClaimIdParams = z.object({
  id: z.string().min(1),
  claimId: z.string().min(1),
});

export const createDeliveryClaimSchema = z.object({
  type: z.enum(['LOST', 'DAMAGED', 'DELAYED', 'WRONG_ITEM', 'PARTIAL', 'OTHER']),
  description: z.string().max(2000).optional(),
  evidenceUrls: z.array(z.string().url()).max(10).default([]),
});

export const updateDeliveryClaimSchema = z.object({
  type: z.enum(['LOST', 'DAMAGED', 'DELAYED', 'WRONG_ITEM', 'PARTIAL', 'OTHER']).optional(),
  description: z.string().max(2000).optional(),
  evidenceUrls: z.array(z.string().url()).max(10).optional(),
});

export const processClaimSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  resolution: z.string().max(2000).optional(),
  payoutAmount: z.number().min(0).max(10_000_000).optional(),
});

export const listClaimsQuerySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'PAID']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateDeliveryClaimDto = z.infer<typeof createDeliveryClaimSchema>;
export type UpdateDeliveryClaimDto = z.infer<typeof updateDeliveryClaimSchema>;
export type ProcessClaimDto = z.infer<typeof processClaimSchema>;
