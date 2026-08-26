import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { campaignsService } from '../../services/campaigns.service.js';
import { sendSuccess } from '../../utils/api-response.js';

/** Campaigns controller - broadcast lifecycle: create -> launch -> stats. */
export const campaignsController = {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaignsService.list(getStoreId(req)));
  },

  async create(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaignsService.create(getStoreId(req), req.body), undefined, 201);
  },

  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaignsService.get(getStoreId(req), req.params.id));
  },

  /** Launch materializes the audience and hands off to the paced dispatcher. */
  async launch(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaignsService.launch(getStoreId(req), req.params.id));
  },

  async pause(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaignsService.pause(getStoreId(req), req.params.id));
  },

  async cancel(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaignsService.cancel(getStoreId(req), req.params.id));
  },

  async stats(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await campaignsService.stats(getStoreId(req), req.params.id));
  },
} as const;
