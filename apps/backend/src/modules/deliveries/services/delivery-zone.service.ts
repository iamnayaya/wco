import type { DeliveryZone } from '@prisma/client';
import { NotFoundError, ConflictError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';

/**
 * DeliveryZoneService — delivery zone management.
 *
 * Manages delivery zones (polygons or radius-based) for each store,
 * enabling zone-based pricing and delivery availability checks.
 */
export class DeliveryZoneService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async list(
    storeId: string,
    page: number,
    pageSize: number,
    filters: { isActive?: boolean } = {},
  ): Promise<DeliveryZone[]> {
    const where: Record<string, unknown> = { storeId };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    return this.db.deliveryZone.findMany({
      where: where as never,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async count(storeId: string, isActive?: boolean): Promise<number> {
    const where: Record<string, unknown> = { storeId };
    if (isActive !== undefined) where.isActive = isActive;
    return this.db.deliveryZone.count({ where: where as never });
  }

  async getById(storeId: string, id: string): Promise<DeliveryZone> {
    const zone = await this.db.deliveryZone.findFirst({ where: { id, storeId } });
    if (!zone) throw new NotFoundError('Delivery zone');
    return zone;
  }

  async create(storeId: string, data: {
    name: string;
    type: string;
    coordinates: number[][];
    centerLat?: number;
    centerLng?: number;
    radiusKm?: number;
    fee: number;
    etaMinutes?: number;
    isActive?: boolean;
    meta?: Record<string, unknown>;
  }): Promise<DeliveryZone> {
    const zone = await this.db.deliveryZone.create({
      data: {
        storeId,
        name: data.name,
        type: data.type as never,
        coordinates: data.coordinates,
        centerLat: data.centerLat,
        centerLng: data.centerLng,
        radiusKm: data.radiusKm,
        fee: data.fee,
        etaMinutes: data.etaMinutes,
        isActive: data.isActive ?? true,
        meta: data.meta ?? {},
      },
    });

    logger.info('delivery-zone.created', { zoneId: zone.id, storeId });
    return zone;
  }

  async update(storeId: string, id: string, data: Partial<{
    name: string;
    type: string;
    coordinates: number[][];
    centerLat: number;
    centerLng: number;
    radiusKm: number;
    fee: number;
    etaMinutes: number;
    isActive: boolean;
    meta: Record<string, unknown>;
  }>): Promise<DeliveryZone> {
    await this.getById(storeId, id);

    const updated = await this.db.deliveryZone.update({
      where: { id },
      data: data as never,
    });

    logger.info('delivery-zone.updated', { zoneId: id });
    return updated;
  }

  async remove(storeId: string, id: string): Promise<void> {
    const zone = await this.getById(storeId, id);
    await this.db.deliveryZone.delete({ where: { id: zone.id } });
    logger.info('delivery-zone.deleted', { zoneId: id });
  }

  /**
   * Check if a point (lat/lng) is within a zone.
   * Supports both polygon containment and radius-based checks.
   */
  async isPointInZone(
    storeId: string,
    zoneId: string,
    lat: number,
    lng: number,
  ): Promise<{ inZone: boolean; zone: DeliveryZone }> {
    const zone = await this.getById(storeId, zoneId);

    // Radius-based check
    if (zone.type === 'RADIUS' && zone.centerLat != null && zone.centerLng != null && zone.radiusKm != null) {
      const distance = this.haversineDistance(lat, lng, zone.centerLat, zone.centerLng);
      return { inZone: distance <= zone.radiusKm, zone };
    }

    // Polygon point-in-polygon check (ray casting algorithm)
    const coords = zone.coordinates as number[][];
    if (Array.isArray(coords) && coords.length >= 3) {
      const inZone = this.pointInPolygon(lat, lng, coords);
      return { inZone, zone };
    }

    return { inZone: false, zone };
  }

  /**
   * Haversine distance between two points in km.
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /**
   * Ray casting algorithm for point-in-polygon.
   * coordinates: [[lng, lat], [lng, lat], ...]
   */
  private pointInPolygon(lat: number, lng: number, coordinates: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
      const xi = coordinates[i][1], yi = coordinates[i][0];
      const xj = coordinates[j][1], yj = coordinates[j][0];

      if ((yi > lng) !== (yj > lng) && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }
}

export const deliveryZoneService = new DeliveryZoneService();
