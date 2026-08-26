import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { paymentRefundsService } from './services/payment-refunds.service.js';

/**
 * Payment refunds controller — dedicated refund management endpoints.
 *
 * Provides CRUD for refunds scoped to a payment. Processes refunds through
 * the PSP and tracks refund status through to settlement.
 */
export const paymentRefundsController = {
  async list(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      paymentRefundsService.list(storeId, req.params.id, {
        page,
        pageSize,
        status: q.status as string | undefined,
        sortBy: String(q.sortBy || 'createdAt'),
        sortOrder: String(q.sortOrder || 'desc'),
      }),
      paymentRefundsService.count(storeId, req.params.id),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentRefundsService.getById(getStoreId(req), req.params.id, req.params.refundId));
  },

  async create(req: Request, res: Response): Promise<void> {
    const refund = await paymentRefundsService.create(getStoreId(req), req.params.id, req.body);
    sendSuccess(res, refund, undefined, 201);
  },

  async process(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentRefundsService.process(getStoreId(req), req.params.id, req.params.refundId));
  },

  async cancel(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await paymentRefundsService.cancel(getStoreId(req), req.params.id, req.params.refundId));
  },
} as const;
