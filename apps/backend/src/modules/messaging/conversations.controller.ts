import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { conversationsService } from '../../services/conversations.service.js';
import { sendSuccess } from '../../utils/api-response.js';

/** Conversations controller - thread listing, message history, agent actions. */
export const conversationsController = {
  async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await conversationsService.list(getStoreId(req), req.query as never), {
      pagination: { nextCursor: null },
    });
  },

  async messages(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await conversationsService.messages(getStoreId(req), req.params.id, req.query as never));
  },

  /** Outbound send enqueues through BullMQ; delivery is asynchronous. */
  async sendMessage(req: Request, res: Response): Promise<void> {
    const message = await conversationsService.sendMessage(getStoreId(req), req.params.id, req.body);
    sendSuccess(res, message, undefined, 201);
  },

  async assignAgent(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await conversationsService.assignAgent(getStoreId(req), req.params.id, req.body.userId));
  },

  async setBotEnabled(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await conversationsService.setBotEnabled(getStoreId(req), req.params.id, req.body.enabled));
  },

  async escalate(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await conversationsService.escalate(getStoreId(req), req.params.id));
  },
} as const;
