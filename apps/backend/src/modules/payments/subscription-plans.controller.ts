import type { Request, Response } from 'express';

import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { subscriptionPlansService } from './services/subscription-plans.service.js';

/** Subscription plan management — platform ops. */
export const subscriptionPlansController = {
  async list(req: Request, res: Response): Promise<void> {
    const q = req.query as { page?: string; pageSize?: string; isActive?: string };
    const page = Number(q.page) || 1;
    const pageSize = Number(q.pageSize) || 20;
    const isActive = q.isActive !== undefined ? q.isActive === 'true' : undefined;
    const [items, total] = await Promise.all([
      subscriptionPlansService.list({ page, pageSize, isActive }),
      subscriptionPlansService.count(isActive),
    ]);
    sendSuccess(res, items, paginationMeta(page, pageSize, total));
  },

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await subscriptionPlansService.getById(req.params.id));
  },

  async getBySlug(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await subscriptionPlansService.getBySlug(req.params.slug));
  },

  async create(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await subscriptionPlansService.create(req.body), undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await subscriptionPlansService.update(req.params.id, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await subscriptionPlansService.remove(req.params.id);
    sendSuccess(res, { deleted: true });
  },
} as const;
