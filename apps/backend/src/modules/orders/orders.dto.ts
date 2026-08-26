import { ORDER_CHANNELS, ORDER_STATUSES } from '@wco/shared';
import { z } from 'zod';

/**
 * Order DTOs.
 *
 * Money math happens server-side: the client sends product/variant IDs and
 * quantities only - never prices. Discounts/delivery fees are merchant
 * inputs capped by sane bounds; totals are recomputed in OrdersService.
 *
 * v2 adds offset pagination (page/pageSize, default 20 / max 100), richer
 * filters (status set, channel, customer, totals range, date range), a
 * whitelisted sort, and the sub-resource bodies (items, notes, refunds,
 * cancellations).
 */

const itemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  quantity: z.number().int().positive().max(999),
  note: z.string().max(500).optional(),
});

export const createOrderSchema = z.object({
  items: z.array(itemSchema).min(1).max(100),
  customerId: z.string().max(64).optional(),
  customerPhone: z.string().max(20).optional(),
  channel: z.enum(ORDER_CHANNELS).default('DASHBOARD'),
  discount: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
  deliveryAddress: z.string().max(500).optional(),
  deliveryCity: z.string().max(120).optional(),
});
export type CreateOrderDto = z.infer<typeof createOrderSchema>;

/** Post-creation edits - logistics/context fields only, never money lines. */
export const updateOrderSchema = z
  .object({
    notes: z.string().max(2000).optional(),
    deliveryAddress: z.string().max(500).nullable().optional(),
    deliveryCity: z.string().max(120).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });
export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;

const SORT_KEYS = ['createdAt', 'total', 'status'] as const;

/** Legacy cursor-list query (shipped clients) - kept for GET /. */
export const listOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().max(120).optional(),
  customerId: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(255).optional(),
});
export type ListOrdersQueryDto = z.infer<typeof listOrdersQuerySchema>;

export const listOrdersV2QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ORDER_STATUSES).optional(),
  channel: z.enum(ORDER_CHANNELS).optional(),
  customerId: z.string().max(64).optional(),
  q: z.string().max(120).optional(),
  minTotal: z.coerce.number().nonnegative().optional(),
  maxTotal: z.coerce.number().nonnegative().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(SORT_KEYS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ListOrdersV2Query = z.infer<typeof listOrdersV2QuerySchema>;

/** Legal forward transitions (cancel/refund handled by dedicated services). */
export const transitionStatuses = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

export const orderTransitionSchema = z.object({
  status: z.enum(transitionStatuses),
  reason: z.string().max(500).optional(),
});
export type OrderTransitionDto = z.infer<typeof orderTransitionSchema>;

// --- params -------------------------------------------------------------------

export const idParams = z.object({ id: z.string().min(1) });
export type IdParams = z.infer<typeof idParams>;

const idString = z.string().min(1);
export const itemParams = z.object({ id: idString, itemId: idString });
export type ItemParams = z.infer<typeof itemParams>;
export const noteParams = z.object({ id: idString, noteId: idString });
export type NoteParams = z.infer<typeof noteParams>;
export const refundParams = z.object({ id: idString, refundId: idString });
export type RefundParams = z.infer<typeof refundParams>;
export const cancellationParams = z.object({ id: idString, cancellationId: idString });
export type CancellationParams = z.infer<typeof cancellationParams>;

// --- order items ----------------------------------------------------------------

export const itemUpdateSchema = z
  .object({
    quantity: z.number().int().positive().max(999).optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });
export type ItemUpdateDto = z.infer<typeof itemUpdateSchema>;

// --- order notes ------------------------------------------------------------------

export const noteBodySchema = z.object({
  body: z.string().trim().min(1).max(2000),
  pinned: z.boolean().default(false),
});
export const NOTE_BODY_FIELDS = { body: noteBodySchema.shape.body, pinned: noteBodySchema.shape.pinned };
export const noteUpdateSchema = z
  .object(NOTE_BODY_FIELDS)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

// --- refunds -------------------------------------------------------------------------

const refundFields = {
  amount: z.number().positive().max(100_000_000),
  reason: z.string().max(500).optional(),
};
export const refundBodySchema = z.object(refundFields);
export const refundUpdateSchema = z
  .object(refundFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

// --- cancellations -----------------------------------------------------------------------

export const cancellationBodySchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type OrderCsvRow = {
  readonly customerPhone: string;
  readonly itemsSpec: string;
  readonly discount: number | null;
  readonly deliveryFee: number | null;
  readonly address: string | null;
  readonly city: string | null;
  readonly channel: string;
};

export type OrderImportReport = {
  readonly created: number;
  readonly failedRows: ReadonlyArray<{ row: number; error: string }>;
};
