import type { EscalationReason, EscalationStatus } from '@prisma/client';
import type { Request, Response } from 'express';


import { getAuth, getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { escalationsService } from './services/escalations.service.js';

/** Human hand-off queue for conversations the bot could not handle. */
export const escalationsController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as {
      page: number;
      pageSize: number;
      status?: EscalationStatus;
      reason?: EscalationReason;
      threadId?: string;
    };
    const result = await escalationsService.list(getStoreId(req), query);
    sendSuccess(res, result.items, {
      pagination: paginationMeta(query.page, query.pageSize, result.meta.totalItems),
    });
  },

  async create(req: Request, res: Response): Promise<void> {
    const escalation = await escalationsService.create(
      getStoreId(req),
      req.body as { threadId: string; messageId?: string; reason: EscalationReason; notes?: string },
      getAuth(req).userId,
    );
    sendSuccess(res, escalation, undefined, 201);
  },

  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await escalationsService.get(getStoreId(req), req.params.id));
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await escalationsService.update(getStoreId(req), req.params.id, req.body));
  },

  /** DELETE = dismiss (false-positive cleanup), not a hard delete. */
  async remove(req: Request, res: Response): Promise<void> {
    await escalationsService.remove(getStoreId(req), req.params.id);
    const dismissed = await escalationsService.get(getStoreId(req), req.params.id);
    sendSuccess(res, dismissed);
  },

  async resolve(req: Request, res: Response): Promise<void> {
    const body = req.body as { resolutionNote?: string };
    const escalation = await escalationsService.resolve(
      getStoreId(req),
      req.params.id,
      body.resolutionNote,
      getAuth(req).userId ?? '',
    );
    sendSuccess(res, escalation);
  },
} as const;
