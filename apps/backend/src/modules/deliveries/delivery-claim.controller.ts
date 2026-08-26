import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { deliveryClaimService } from './services/delivery-claim.service.js';

export const deliveryClaimController = {
  async listByDelivery(req: Request, res: Response): Promise<void> {
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      deliveryClaimService.listByDelivery(req.params.id, page, pageSize, {
        status: q.status as string | undefined,
      }),
      deliveryClaimService.countByDelivery(req.params.id, q.status as string | undefined),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async listByStore(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      deliveryClaimService.listByStore(storeId, page, pageSize, {
        status: q.status as string | undefined,
      }),
      deliveryClaimService.countByStore(storeId, q.status as string | undefined),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryClaimService.getById(req.params.id, req.params.claimId));
  },

  async create(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    sendSuccess(res, await deliveryClaimService.create(req.params.id, storeId, req.body), undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryClaimService.update(req.params.id, req.params.claimId, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await deliveryClaimService.remove(req.params.id, req.params.claimId);
    sendSuccess(res, { deleted: true });
  },

  async process(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryClaimService.process(req.params.claimId, req.body));
  },
} as const;
