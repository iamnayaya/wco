import type { Product, ProductDiscount } from '@prisma/client';
import { NotFoundError, ValidationError } from '@wco/shared';

import { prisma } from '../../../lib/prisma.js';
import type { DiscountBodyDto } from '../products.dto.js';

import { mapUniqueViolation, requireProduct } from './shared.js';

/**
 * Per-product promo codes. `applyDiscount` is the single pricing truth used
 * by checkout drafts and the WhatsApp quote flow - it never mutates state.
 */

export interface ResolvedDiscount {
  readonly code: string;
  readonly originalPrice: number;
  readonly discountedPrice: number;
  readonly savings: number;
  readonly label: string | null;
}

/** Pure price math - unit tested. */
export function computeDiscountedPrice(
  basePrice: number,
  type: 'PERCENTAGE' | 'FIXED',
  value: number,
): number {
  const raw = type === 'PERCENTAGE' ? basePrice * (1 - value / 100) : basePrice - value;
  return Math.max(0, Math.round(raw * 100) / 100);
}

export function isDiscountLive(
  discount: { active: boolean; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
): boolean {
  if (!discount.active) return false;
  if (discount.startsAt && now < discount.startsAt) return false;
  if (discount.endsAt && now > discount.endsAt) return false;
  return true;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export class ProductDiscountService {
  async create(storeId: string, productId: string, data: DiscountBodyDto): Promise<ProductDiscount> {
    await requireProduct(storeId, productId);
    try {
      return await prisma.productDiscount.create({
        data: {
          storeId,
          productId,
          code: data.code.toUpperCase(),
          type: data.type,
          value: data.value,
          label: data.label,
          active: data.active,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
        },
      });
    } catch (err) {
      throw mapUniqueViolation(err, 'This discount code already exists in your store');
    }
  }

  async list(storeId: string, productId: string): Promise<ProductDiscount[]> {
    await requireProduct(storeId, productId);
    return prisma.productDiscount.findMany({ where: { productId }, orderBy: { createdAt: 'desc' as const } });
  }

  async getOwned(storeId: string, productId: string, discountId: string): Promise<ProductDiscount> {
    await requireProduct(storeId, productId);
    const rows = await prisma.productDiscount.findMany({ where: { id: discountId, productId }, take: 1 });
    const row = rows.at(0);
    if (!row) throw new NotFoundError('Discount');
    return row;
  }

  async update(
    storeId: string,
    productId: string,
    discountId: string,
    patch: Partial<DiscountBodyDto>,
  ): Promise<ProductDiscount> {
    await this.getOwned(storeId, productId, discountId);
    try {
      return await prisma.productDiscount.update({
        where: { id: discountId },
        data: { ...patch, ...(patch.code ? { code: patch.code.toUpperCase() } : {}) },
      });
    } catch (err) {
      throw mapUniqueViolation(err, 'This discount code already exists in your store');
    }
  }

  async delete(storeId: string, productId: string, discountId: string): Promise<void> {
    await this.getOwned(storeId, productId, discountId);
    await prisma.productDiscount.delete({ where: { id: discountId } });
  }

  /** Price-quote resolution. Throws ValidationError for dead/unknown codes. */
  async apply(storeId: string, productId: string, code: string, now = new Date()): Promise<ResolvedDiscount & { product: Pick<Product, 'id' | 'name'> }> {
    const product = await requireProduct(storeId, productId);
    const normalized = code.trim().toUpperCase();
    const rows = await prisma.productDiscount.findMany({
      where: { storeId, productId, code: normalized },
      take: 1,
    });
    const discount = rows.at(0);
    if (!discount || !isDiscountLive(discount, now)) {
      throw new ValidationError('Discount code is invalid or expired');
    }
    const base = toNumber(product.price);
    const discountedPrice = computeDiscountedPrice(base, discount.type, toNumber(discount.value));
    return {
      code: normalized,
      originalPrice: base,
      discountedPrice,
      savings: Math.max(0, Math.round((base - discountedPrice) * 100) / 100),
      label: discount.label,
      product: { id: product.id, name: product.name },
    };
  }
}

export const productDiscountService = new ProductDiscountService();
