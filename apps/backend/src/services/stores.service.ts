import type { Prisma, Store } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '@wco/shared';

import { prisma } from '../lib/prisma.js';

/**
 * Store management — the tenant unit that owns catalog/orders/conversations.
 * All methods are explicitly merchant-scoped; there is no unscoped accessor.
 */

export type CreateStoreInput = Pick<
  Prisma.StoreUncheckedCreateInput,
  'name' | 'description' | 'whatsappNumber' | 'currency' | 'timezone' | 'address' | 'city' | 'country'
>;

export class StoresService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async create(merchantId: string, input: CreateStoreInput): Promise<Store> {
    const baseSlug = slugify(input.name);
    const slug = await uniqueSlug(this.db, baseSlug);
    return this.db.store.create({
      data: {
        merchantId,
        name: input.name,
        description: input.description,
        slug,
        whatsappNumber: input.whatsappNumber ?? null,
        currency: input.currency ?? 'NGN',
        timezone: input.timezone ?? 'Africa/Lagos',
        address: input.address,
        city: input.city,
        country: input.country ?? 'NG',
        status: 'ACTIVE',
      },
    });
  }

  async list(merchantId: string): Promise<Store[]> {
    return this.db.store.findMany({ where: { merchantId }, orderBy: { createdAt: 'asc' } });
  }

  async get(merchantId: string, storeId: string): Promise<Store> {
    const store = await this.db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) throw new NotFoundError('Store');
    return store;
  }

  async update(merchantId: string, storeId: string, patch: Partial<CreateStoreInput>): Promise<Store> {
    await this.get(merchantId, storeId); // 404 + scope check
    const { name, ...rest } = patch;
    const data: Prisma.StoreUpdateInput = { ...rest };
    if (name !== undefined) {
      data.slug = await uniqueSlug(this.db, slugify(name), storeId);
      data.name = name;
    }
    return this.db.store.update({ where: { id: storeId }, data });
  }

  async assertMembership(merchantId: string, storeId: string): Promise<void> {
    const found = await this.db.store.findFirst({
      where: { id: storeId, merchantId },
      select: { id: true },
    });
    if (!found) throw new ForbiddenError('Store does not belong to this merchant');
  }
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'store'
  );
}

async function uniqueSlug(db: typeof prisma, base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 10; i++) {
    const clash = await db.store.findFirst({ where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) } });
    if (!clash) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  throw new ConflictGeneratingSlug(base);
}

export class ConflictGeneratingSlug extends Error {
  constructor(base: string) {
    super(`Could not generate a unique slug for "${base}"`);
    this.name = 'ConflictGeneratingSlug';
  }
}

export const storesService = new StoresService();
