import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { deliveryProviderService } from './services/delivery-provider.service.js';

export const deliveryProviderController = {
  async list(req: Request, res: Response): Promise<void> {
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      deliveryProviderService.list(page, pageSize, {
        isActive: q.isActive !== undefined ? q.isActive === 'true' : undefined,
        country: q.country as string | undefined,
      }),
      deliveryProviderService.count({
        isActive: q.isActive !== undefined ? q.isActive === 'true' : undefined,
        country: q.country as string | undefined,
      }),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryProviderService.getById(req.params.id));
  },

  async create(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryProviderService.create(req.body), undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryProviderService.update(req.params.id, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await deliveryProviderService.remove(req.params.id);
    sendSuccess(res, { deleted: true });
  },

  async getAvailableProviders(req: Request, res: Response): Promise<void> {
    const q = req.query as Record<string, unknown>;
    sendSuccess(res, await deliveryProviderService.getAvailableProviders(
      q.pickupAddress as string,
      q.dropoffAddress as string,
      q.weight as number | undefined,
      q.length && q.width && q.height
        ? { length: Number(q.length), width: Number(q.width), height: Number(q.height) }
        : undefined,
    ));
  },
} as const;
