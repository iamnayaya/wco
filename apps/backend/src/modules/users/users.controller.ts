import type { Request, Response } from 'express';

import { getAuth } from '../../middleware/rbac.js';
import { usersService } from '../../services/users.service.js';
import { sendSuccess } from '../../utils/api-response.js';

/**
 * Users controller - team management for a merchant.
 * Merchant scoping comes from the authenticated context (never from params),
 * so an ADMIN of merchant A cannot mutate merchant B's staff.
 */
export const usersController = {
  async list(req: Request, res: Response): Promise<void> {
    const merchantId = getAuth(req).merchantId;
    sendSuccess(res, await usersService.list(merchantId));
  },

  async create(req: Request, res: Response): Promise<void> {
    const user = await usersService.create(getAuth(req).merchantId, req.body);
    sendSuccess(res, user, undefined, 201);
  },

  async updateRole(req: Request, res: Response): Promise<void> {
    await usersService.updateRole(getAuth(req).merchantId, req.params.id, req.body.role);
    sendSuccess(res, { updated: true });
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    await usersService.setActive(getAuth(req).merchantId, req.params.id, req.body.isActive);
    sendSuccess(res, { updated: true });
  },
} as const;
