import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { deliveryZoneService } from './services/delivery-zone.service.js';

export const deliveryZoneController = {
  async list(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      deliveryZoneService.list(storeId, page, pageSize, {
        isActive: q.isActive !== undefined ? q.isActive === 'true' : undefined,
      }),
      deliveryZoneService.count(storeId, q.isActive !== undefined ? q.isActive === 'true' : undefined),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryZoneService.getById(getStoreId(req), req.params.id));
  },

  async create(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryZoneService.create(getStoreId(req), req.body), undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryZoneService.update(getStoreId(req), req.params.id, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await deliveryZoneService.remove(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  },

  async checkAddressInZone(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const { latitude, longitude } = req.body;
    sendSuccess(res, await deliveryZoneService.isPointInZone(storeId, req.params.id, latitude, longitude));
  },
} as const;
