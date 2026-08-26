import { z } from 'zod';

/** Shared Zod schemas — single validation contract reused by API, AI tools and clients. */

export const phoneSchema = z
  .string()
  .regex(/^\+?[0-9\s-]{7,20}$/, 'Invalid phone number format');

export const e164PhoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164');

export const moneyAmountSchema = z.number().nonnegative().multipleOf(0.01).max(999_999_999);

export const orderItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1).max(10_000),
  note: z.string().max(500).optional(),
});

export const createOrderSchema = z.object({
  customerId: z.string().cuid(),
  items: z.array(orderItemSchema).min(1).max(100),
  channel: z.enum(['WHATSAPP', 'DASHBOARD', 'PAYMENT_LINK']).default('DASHBOARD'),
  deliveryAddress: z.string().max(2000).optional(),
  deliveryCity: z.string().max(120).optional(),
});

export const productCreateSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(64),
  description: z.string().max(5000).optional(),
  price: moneyAmountSchema,
  costPrice: moneyAmountSchema.optional(),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).max(10_000).default(5),
  categoryId: z.string().cuid().optional(),
  images: z.array(z.string().url()).max(8).default([]),
  status: z.enum(['ACTIVE', 'DRAFT', 'OUT_OF_STOCK', 'ARCHIVED']).default('ACTIVE'),
});

export const storeCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  whatsappNumber: phoneSchema,
  currency: z.enum(['NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'USD']).default('NGN'),
  city: z.string().max(120).optional(),
  country: z.enum(['NG', 'GH', 'KE']).default('NG'),
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export const registerSchema = z.object({
  companyName: z.string().min(2).max(120),
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a digit'),
  phone: phoneSchema.optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
