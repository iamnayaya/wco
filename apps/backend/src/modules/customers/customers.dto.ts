import { z } from 'zod';

/** Customer directory DTOs - WhatsApp-first CRM records. */

export const listCustomersQuerySchema = z.object({
  q: z.string().max(120).optional(),
  segment: z.string().max(40).optional(),
  tag: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(255).optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(254).optional(),
  notes: z.string().max(5000).optional(),
  marketingOptIn: z.boolean().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
});

export const addTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(40)).min(1).max(20),
});

export const idParams = z.object({ id: z.string().min(1) });

/** Compound param: /customer-tags/:id/customers/:customerId */
export const tagCustomerParams = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
});

export const noteParams = z.object({
  id: z.string().min(1),
  noteId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// v2 - offset listing, lifecycle, import/export
// ---------------------------------------------------------------------------

const SORTABLE = ['createdAt', 'name', 'totalSpent', 'ordersCount', 'lastOrderAt'] as const;

export const listCustomersV2QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(120).optional(),
  tag: z.string().max(40).optional(),
  segment: z.string().max(40).optional(),
  marketingOptIn: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  minSpent: z.coerce.number().min(0).optional(),
  maxSpent: z.coerce.number().min(0).optional(),
  sortBy: z.enum(SORTABLE).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListCustomersV2Query = z.infer<typeof listCustomersV2QuerySchema>;

export const searchCustomersQuerySchema = listCustomersV2QuerySchema.extend({
  q: z.string().min(1, 'Search query is required').max(120),
});

export const createCustomerSchema = z.object({
  waPhone: z.string().min(7).max(20),
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().max(254).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  marketingOptIn: z.boolean().default(false),
  notes: z.string().max(5000).optional(),
});

export const deleteCustomerParams = idParams;

// Notes ---------------------------------------------------------------------

export const createNoteSchema = z.object({
  body: z.string().min(1).max(5000),
  pinned: z.boolean().default(false),
});

export const updateNoteSchema = z
  .object({
    body: z.string().min(1).max(5000).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

// Tags ----------------------------------------------------------------------

export const createTagSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const updateTagSchema = createTagSchema.partial();

// Segments ------------------------------------------------------------------

/**
 * Declarative matcher evaluated by the segmentation engine. All keys are
 * optional; an empty rule means "manual membership only".
 */
export const segmentRuleSchema = z
  .object({
    minTotalSpent: z.number().min(0).optional(),
    maxTotalSpent: z.number().min(0).optional(),
    minOrders: z.number().int().min(0).optional(),
    maxOrders: z.number().int().min(0).optional(),
    idleDaysMin: z.number().min(0).optional(), // days since last order (lower bound)
    idleDaysMax: z.number().min(0).optional(),
    newWithinDays: z.number().int().min(1).optional(), // created within N days & <= maxOrders
    marketingOptIn: z.boolean().optional(),
  })
  .strict();

export const createSegmentSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(280).optional(),
  rule: segmentRuleSchema.default({}),
});

export const updateSegmentSchema = createSegmentSchema.partial();

export type ListCustomersQueryDto = z.infer<typeof listCustomersQuerySchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
export type AddTagsDto = z.infer<typeof addTagsSchema>;
