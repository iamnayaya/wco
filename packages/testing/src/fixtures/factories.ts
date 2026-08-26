/**
 * Deterministic test factories — every entity gets a stable, unique identity
 * so tests can run in parallel without collisions.
 */
import type { Prisma } from '@prisma/client';

let counter = 0;
function seq(): number {
  return ++counter;
}

export function merchantFactory(overrides: Partial<Prisma.MerchantCreateInput> = {}): Prisma.MerchantCreateInput {
  return {
    companyName: `Test Merchant ${seq()}`,
    email: `merchant-${Date.now()}-${seq()}@test.wco.app`,
    country: 'NG',
    plan: 'GROWTH',
    ...overrides,
  };
}

export function userFactory(
  merchantId: string,
  overrides: Partial<Prisma.UserUncheckedCreateInput> = {},
): Prisma.UserUncheckedCreateInput {
  return {
    merchantId,
    email: `user-${Date.now()}-${seq()}@test.wco.app`,
    fullName: 'Test Owner',
    passwordHash: '$argon2id$placeholder-hash-for-tests',
    role: 'OWNER',
    ...overrides,
  };
}

export function storeFactory(
  merchantId: string,
  overrides: Partial<Prisma.StoreUncheckedCreateInput> = {},
): Prisma.StoreUncheckedCreateInput {
  return {
    merchantId,
    name: `Store ${seq()}`,
    slug: `store-${Date.now()}-${seq()}`,
    whatsappNumber: `+234801234${String(1000 + seq()).slice(-4)}`,
    currency: 'NGN',
    ...overrides,
  };
}

export function productFactory(storeId: string, overrides: Partial<Prisma.ProductUncheckedCreateInput> = {}): Prisma.ProductUncheckedCreateInput {
  return {
    storeId,
    sku: `SKU-${seq()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    name: `Product ${seq()}`,
    price: 2500,
    stockQuantity: 100,
    status: 'ACTIVE',
    images: [],
    ...overrides,
  };
}

export function customerFactory(storeId: string, overrides: Partial<Prisma.CustomerUncheckedCreateInput> = {}): Prisma.CustomerUncheckedCreateInput {
  return {
    storeId,
    waPhone: `+234701234${String(1000 + seq()).slice(-4)}`,
    name: `Customer ${seq()}`,
    marketingOptIn: true,
    ...overrides,
  };
}
