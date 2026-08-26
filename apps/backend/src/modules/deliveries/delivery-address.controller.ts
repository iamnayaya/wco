import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { deliveryAddressService } from './services/delivery-address.service.js';

export const deliveryAddressController = {
  async list(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      deliveryAddressService.list(storeId, page, pageSize, { city: q.city as string | undefined }),
      deliveryAddressService.count(storeId, q.city as string | undefined),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryAddressService.getById(getStoreId(req), req.params.id));
  },

  async create(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryAddressService.create(getStoreId(req), req.body), undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryAddressService.update(getStoreId(req), req.params.id, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await deliveryAddressService.remove(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  },

  async getDefault(req: Request, res: Response): Promise<void> {
    const address = await deliveryAddressService.getDefault(getStoreId(req));
    sendSuccess(res, address);
  },
} as const;
