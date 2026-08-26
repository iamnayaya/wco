import { z } from 'zod';

/**
 * User Management DTOs - self-service + platform-admin contracts.
 *
 * Conventions mirror auth.dto: lowercase-transform emails, strict enums for
 * lifecycle state, cuid-ish ids in params. All bodies are partial-safe
 * (`.strict()` rejects unknown keys so typos never silently no-op).
 */

export const idParams = z.object({ id: z.string().min(10).max(40) });

const email = z.string().email().max(254).transform((v) => v.toLowerCase());
const phoneE164 = z
  .string()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Phone must be E.164-ish (e.g. +2348012345678)');

// ---------------------------------------------------------------------------
// Platform admin - user lifecycle
// ---------------------------------------------------------------------------

export const adminCreateUserSchema = z
  .object({
    companyName: z.string().min(2).max(120),
    fullName: z.string().min(2).max(120),
    email,
    password: z.string().min(8).max(128),
    phone: phoneE164.optional(),
    country: z.enum(['NG', 'GH', 'KE']).default('NG'),
    /** Staff accounts (role ADMIN) require merchantId; sellers omit it. */
    role: z.enum(['OWNER', 'ADMIN']).default('OWNER'),
    merchantId: z.string().min(10).max(40).optional(),
  })
  .refine((v) => v.role !== 'ADMIN' || Boolean(v.merchantId), {
    message: 'Staff users require merchantId',
    path: ['merchantId'],
  });

export const adminUpdateUserSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    phone: phoneE164.nullable().optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const suspendSchema = z.object({
  reason: z.string().min(3).max(280),
});

/** Sort whitelist - free-form orderBy strings would let clients probe columns. */
export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(120).optional(),
  email: email.optional(),
  phone: z.string().max(20).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  role: z.enum(['OWNER', 'ADMIN', 'SUPER_ADMIN', 'AGENT', 'VIEWER']).optional(),
  sortBy: z.enum(['createdAt', 'email', 'fullName', 'lastLoginAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

// ---------------------------------------------------------------------------
// Self-service profile
// ---------------------------------------------------------------------------

export const updateMeSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    phone: phoneE164.optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const sellerProfileCreateSchema = z.object({
  businessName: z.string().min(2).max(120),
  businessCategory: z.string().max(60).optional(),
  bio: z.string().max(500).optional(),
  city: z.string().max(60).optional(),
  state: z.string().max(60).optional(),
  country: z.enum(['NG', 'GH', 'KE']).default('NG'),
  address: z.string().max(240).optional(),
  yearsInBusiness: z.number().int().min(0).max(80).optional(),
  monthlyRevenueBand: z.enum(['<50k', '50k-250k', '250k-1m', '>1m']).optional(),
  socials: z.record(z.string(), z.string()).optional(),
});

export const sellerProfileUpdateSchema = sellerProfileCreateSchema.partial();

export const adminProfileUpsertSchema = z.object({
  title: z.string().max(80).optional(),
  department: z.string().max(80).optional(),
  permissions: z.array(z.string().max(60)).max(50).default([]),
});

// ---------------------------------------------------------------------------
// Subscription / WhatsApp / payment / delivery
// ---------------------------------------------------------------------------

export const subscriptionCreateSchema = z.object({
  planCode: z.enum(['FREE', 'STARTER', 'GROWTH', 'SCALE']),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']).default('MONTHLY'),
});

export const subscriptionUpdateSchema = z
  .object({
    billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const waConnectionSchema = z.object({
  phone: phoneE164,
  phoneNumberId: z.string().min(5).max(40).optional(),
  wabaId: z.string().min(5).max(40).optional(),
  storeId: z.string().min(10).max(40).optional(),
});

export const waConnectionUpdateSchema = waConnectionSchema.partial();

export const paymentMethodCreateSchema = z.object({
  type: z.enum(['BANK_ACCOUNT', 'MOBILE_MONEY', 'USSD']),
  providerName: z.string().min(2).max(60),
  accountName: z.string().min(2).max(120),
  accountNumber: z.string().regex(/^\d{6,20}$/, 'Account number must be 6-20 digits'),
  bankCode: z.string().max(12).optional(),
  isDefault: z.boolean().default(false),
});

export const paymentMethodUpdateSchema = z.object({
  isDefault: z.boolean().optional(),
  accountName: z.string().min(2).max(120).optional(),
});

export const deliveryProviderLinkSchema = z.object({
  providerCode: z.enum(['GIG', 'KWIK', 'SENDY']),
  accountRef: z.string().max(120).optional(),
  credentials: z.string().min(8).max(2000).optional(),
  isDefault: z.boolean().default(false),
});

export const deliveryProviderUpdateSchema = z.object({
  accountRef: z.string().max(120).optional(),
  credentials: z.string().min(8).max(2000).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
