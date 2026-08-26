import { z } from 'zod';

/**
 * Catalog DTOs. Money arrives as decimal numbers (major units) and is
 * converted to Prisma Decimal in the service layer - clients never send
 * minor units for catalog data (payment providers do that conversion).
 */

export const productBodySchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(64),
  price: z.number().nonnegative().multipleOf(0.01),
  description: z.string().max(5000).optional(),
  compareAtPrice: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  categoryId: z.string().max(64).optional(),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  trackStock: z.boolean().default(true),
  images: z.array(z.string().url()).max(10).default([]),
  status: z.enum(['ACTIVE', 'DRAFT']).default('ACTIVE'),
});

export const listProductsQuerySchema = z.object({
  q: z.string().max(120).optional(),
  categoryId: z.string().max(64).optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'OUT_OF_STOCK', 'ARCHIVED']).optional(),
  lowStockOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(255).optional(),
});

export const categoryBodySchema = z.object({
  name: z.string().min(1).max(80),
  sortOrder: z.number().int().default(0),
});

export const adjustStockSchema = z.object({
  delta: z.number().int(),
  reason: z.string().max(200).optional(),
});

export const idParams = z.object({ id: z.string().min(1) });

// ---------------------------------------------------------------------------
// v2 - offset pagination, subresources, discounts, inventory, AI
// ---------------------------------------------------------------------------

const PRODUCT_SORT_KEYS = ['createdAt', 'name', 'price', 'stockQuantity', 'updatedAt'] as const;

export const listProductsV2QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(120).optional(),
  categoryId: z.string().max(64).optional(),
  tag: z.string().max(40).optional(),
  status: z.enum(['ACTIVE', 'DRAFT', 'OUT_OF_STOCK', 'ARCHIVED']).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  lowStockOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sortBy: z.enum(PRODUCT_SORT_KEYS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const searchProductsQuerySchema = listProductsV2QuerySchema.extend({
  q: z.string().min(1, 'Search query q is required').max(120),
});

export const variantBodySchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  price: z.number().nonnegative().multipleOf(0.01).nullable().optional(),
  costPrice: z.number().nonnegative().optional(),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  attributes: z.record(z.string(), z.string().max(80)).default({}),
});

export const variantUpdateSchema = variantBodySchema.partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const variantParams = z.object({ id: z.string().min(1), variantId: z.string().min(1) });

export const imageUpdateSchema = z
  .object({
    altText: z.string().max(200).optional(),
    position: z.number().int().min(0).max(999).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const imageParams = z.object({ id: z.string().min(1), imageId: z.string().min(1) });

const discountFields = z.object({
  code: z.string().min(3).max(32).regex(/^[A-Za-z0-9_-]+$/, 'Code must be alphanumeric'),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().positive(),
  label: z.string().max(120).optional(),
  active: z.boolean().default(true),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

export const discountBodySchema = discountFields
  .refine((v) => v.type !== 'PERCENTAGE' || v.value <= 90, {
    message: 'Percentage discounts are capped at 90%',
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, {
    message: 'endsAt must be after startsAt',
  });

export const discountUpdateSchema = discountFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const discountParams = z.object({ id: z.string().min(1), discountId: z.string().min(1) });

export const applyDiscountSchema = z.object({ code: z.string().min(3).max(32) });

export const adjustInventorySchema = z
  .object({
    variantId: z.string().max(64).optional(),
    setQuantity: z.number().int().min(0).optional(),
    delta: z.number().int().optional(),
    reason: z
      .enum(['RESTOCK', 'SALE', 'MANUAL_CORRECTION', 'IMPORT', 'DAMAGE', 'RESERVE_RELEASE'])
      .default('MANUAL_CORRECTION'),
    note: z.string().max(500).optional(),
  })
  .refine((v) => (v.setQuantity !== undefined) !== (v.delta !== undefined), {
    message: 'Provide exactly one of setQuantity or delta',
  });

export const categoryV2BodySchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().default(0),
});

export const categoryV2UpdateSchema = categoryV2BodySchema.partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const productTagBodySchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const productTagUpdateSchema = productTagBodySchema.partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const replaceTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(40)).max(20),
});

export const aiDescribeSchema = z.object({
  tone: z.enum(['friendly', 'professional', 'promotional']).default('friendly'),
  maxLength: z.number().int().min(80).max(2000).default(600),
});

export const inventoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(120).optional(),
  lowStockOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default('false'),
});

export type ListProductsV2Query = z.infer<typeof listProductsV2QuerySchema>;
export type VariantBodyDto = z.infer<typeof variantBodySchema>;
export type DiscountBodyDto = z.infer<typeof discountBodySchema>;
export type AdjustInventoryDto = z.infer<typeof adjustInventorySchema>;
export type CategoryV2BodyDto = z.infer<typeof categoryV2BodySchema>;

export type ProductBodyDto = z.infer<typeof productBodySchema>;
export type ListProductsQueryDto = z.infer<typeof listProductsQuerySchema>;
export type CategoryBodyDto = z.infer<typeof categoryBodySchema>;
export type AdjustStockDto = z.infer<typeof adjustStockSchema>;
