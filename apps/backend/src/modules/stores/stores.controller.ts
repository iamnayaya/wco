import type { Request, Response } from 'express';

import { getAuth } from '../../middleware/rbac.js';
import { auditService } from '../../services/audit.service.js';
import { storesService } from '../../services/stores.service.js';
import { sendSuccess } from '../../utils/api-response.js';

/** Stores controller - CRUD for the merchant's commerce locations. */
export const storesController = {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await storesService.list(getAuth(req).merchantId));
  },

  async create(req: Request, res: Response): Promise<void> {
    const store = await storesService.create(getAuth(req).merchantId, req.body);
    void auditService.record({ action: 'store.create', resource: 'Store', resourceId: store.id });
    sendSuccess(res, store, undefined, 201);
  },

  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await storesService.get(getAuth(req).merchantId, req.params.id));
  },

  async update(req: Request, res: Response): Promise<void> {
    const auth = getAuth(req);
    const before = await storesService.get(auth.merchantId, req.params.id);
    const after = await storesService.update(auth.merchantId, req.params.id, req.body);
    void auditService.record({
      action: 'store.update',
      resource: 'Store',
      resourceId: after.id,
      before: { name: before.name },
      after: { name: after.name },
    });
    sendSuccess(res, after);
  },
} as const;
