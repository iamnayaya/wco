import type { DeliveryAddress } from '@prisma/client';
import { NotFoundError, ConflictError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * DeliveryAddressService — saved delivery address management.
 *
 * Manages warehouses, customer addresses, and recurring delivery locations
 * with geocoding support and default address handling.
 */
export class DeliveryAddressService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async list(
    storeId: string,
    page: number,
    pageSize: number,
    filters: { city?: string } = {},
  ): Promise<DeliveryAddress[]> {
    const where: Record<string, unknown> = { storeId };
    if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };

    return this.db.deliveryAddress.findMany({
      where: where as never,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async count(storeId: string, city?: string): Promise<number> {
    const where: Record<string, unknown> = { storeId };
    if (city) where.city = { contains: city, mode: 'insensitive' };
    return this.db.deliveryAddress.count({ where: where as never });
  }

  async getById(storeId: string, id: string): Promise<DeliveryAddress> {
    const address = await this.db.deliveryAddress.findFirst({ where: { id, storeId } });
    if (!address) throw new NotFoundError('Delivery address');
    return address;
  }

  async create(storeId: string, data: {
    label: string;
    contactName?: string;
    contactPhone?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    country: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    isDefault?: boolean;
    meta?: Record<string, unknown>;
  }): Promise<DeliveryAddress> {
    if (data.isDefault) {
      await this.db.deliveryAddress.updateMany({
        where: { storeId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await this.db.deliveryAddress.create({
      data: {
        storeId,
        label: data.label,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        latitude: data.latitude,
        longitude: data.longitude,
        isDefault: data.isDefault ?? false,
        meta: data.meta ?? {},
      },
    });

    logger.info('delivery-address.created', { addressId: address.id, storeId });
    return address;
  }

  async update(storeId: string, id: string, data: Partial<{
    label: string;
    contactName: string;
    contactPhone: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    latitude: number;
    longitude: number;
    isDefault: boolean;
    meta: Record<string, unknown>;
  }>): Promise<DeliveryAddress> {
    await this.getById(storeId, id);

    if (data.isDefault) {
      await this.db.deliveryAddress.updateMany({
        where: { storeId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await this.db.deliveryAddress.update({
      where: { id },
      data: data as never,
    });

    logger.info('delivery-address.updated', { addressId: id });
    return updated;
  }

  async remove(storeId: string, id: string): Promise<void> {
    const address = await this.getById(storeId, id);
    await this.db.deliveryAddress.delete({ where: { id: address.id } });
    logger.info('delivery-address.deleted', { addressId: id });
  }

  async getDefault(storeId: string): Promise<DeliveryAddress | null> {
    return this.db.deliveryAddress.findFirst({
      where: { storeId, isDefault: true },
    });
  }
}

export const deliveryAddressService = new DeliveryAddressService();
