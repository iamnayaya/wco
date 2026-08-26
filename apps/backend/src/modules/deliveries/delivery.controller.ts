import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { deliveryService } from './services/delivery.service.js';

export const deliveryController = {
  async list(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);

    const [items, total] = await Promise.all([
      deliveryService.list(storeId, page, pageSize, {
        status: q.status as string | undefined,
        carrier: q.carrier as string | undefined,
        from: q.from ? new Date(q.from as string) : undefined,
        to: q.to ? new Date(q.to as string) : undefined,
        q: q.q as string | undefined,
        sortBy: q.sortBy as string | undefined,
        sortOrder: q.sortOrder as string | undefined,
      }),
      deliveryService.count(storeId, {
        status: q.status as string | undefined,
        carrier: q.carrier as string | undefined,
        from: q.from ? new Date(q.from as string) : undefined,
        to: q.to ? new Date(q.to as string) : undefined,
        q: q.q as string | undefined,
      }),
    ]);

    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async getById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryService.getById(getStoreId(req), req.params.id));
  },

  async getByOrderId(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryService.getByOrderId(getStoreId(req), req.params.orderId));
  },

  async create(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryService.create(getStoreId(req), req.body), undefined, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryService.update(getStoreId(req), req.params.id, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await deliveryService.remove(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  },

  async quote(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const carrier = typeof req.query.carrier === 'string' ? req.query.carrier : undefined;
    sendSuccess(res, await deliveryService.quote(storeId, req.params.orderId, req.body, carrier));
  },

  async book(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryService.book(getStoreId(req), req.params.id), undefined, 201);
  },

  async cancel(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryService.cancel(getStoreId(req), req.params.id, req.body.reason));
  },

  async calculateCost(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryService.calculateCost(req.body));
  },

  async track(req: Request, res: Response): Promise<void> {
    const delivery = await deliveryService.getById(getStoreId(req), req.params.id);
    sendSuccess(res, {
      delivery,
      trackingCode: delivery.trackingCode,
      carrier: delivery.carrier,
      status: delivery.status,
      lastUpdate: (delivery.meta as Record<string, unknown>)?.lastLocation,
    });
  },

  async rate(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await deliveryService.rate(getStoreId(req), req.params.id, req.body.rating, req.body.comment));
  },

  async stats(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    sendSuccess(res, await deliveryService.getStats(
      storeId,
      q.from ? new Date(q.from as string) : undefined,
      q.to ? new Date(q.to as string) : undefined,
      q.groupBy as string | undefined,
    ));
  },

  async listCarriers(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, { carriers: deliveryService.listConfigured() });
  },
} as const;
