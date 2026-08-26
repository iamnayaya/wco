import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { paymentMethodsService } from './services/payment-methods.service.js';

/**
 * Payment methods controller — merchant payout destination management.
 *
 * CRUD for bank accounts, mobile money wallets, and other payout methods.
 * Account numbers are encrypted at rest; only last-4 digits are returned
 * in list/detail responses.
 */
export const paymentMethodsController = {
  async list(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      paymentMethodsService.list(storeId, { page, pageSize, type: q.type as string | undefined }),
      paymentMethodsService.count(storeId, q.type as string | undefined),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentMethodsService.getById(getStoreId(req), req.params.id));
  },

  async create(req: Request, res: Response): Promise<void> {
    const method = await paymentMethodsService.create(getStoreId(req), req.body);
    sendSuccess(res, method, undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentMethodsService.update(getStoreId(req), req.params.id, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await paymentMethodsService.remove(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  },

  async setDefault(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentMethodsService.setDefault(getStoreId(req), req.params.id));
  },
} as const;
