import type { Request, Response } from 'express';

import { getAuth, getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { messagesService } from './services/messages.service.js';
import { threadsService } from './services/threads.service.js';

/** Message threads (= conversations) - inbox listing + per-thread history. */
export const threadsController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as { page: number; pageSize: number; status?: 'BOT' | 'HANDLED' | 'CLOSED'; q?: string; customerId?: string; assignedToMe: boolean };
    const result = await threadsService.list(getStoreId(req), query, getAuth(req).userId ?? '');
    sendSuccess(res, result.items, { pagination: paginationMeta(query.page, query.pageSize, result.meta.totalItems) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const thread = await threadsService.create(getStoreId(req), (req.body as { customerId: string }).customerId);
    sendSuccess(res, thread, undefined, 201);
  },

  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await threadsService.getDecorated(getStoreId(req), req.params.id));
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await threadsService.update(getStoreId(req), req.params.id, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await threadsService.remove(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  },

  /** Chat history - newest page first; opening a thread clears unread. */
  async messages(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as { limit: number; cursor?: string };
    const result = await messagesService.listInThread(getStoreId(req), req.params.id, query, {
      markRead: true,
    });
    sendSuccess(res, result.items, { pagination: { nextCursor: result.nextCursor } });
  },

  async send(req: Request, res: Response): Promise<void> {
    const body = req.body as { type: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'TEMPLATE'; body?: string; mediaUrl?: string; templateName?: string };
    const message = await messagesService.send(getStoreId(req), req.params.id, {
      type: body.type,
      body: body.body,
      mediaUrl: body.mediaUrl,
      templateName: body.templateName,
      sentByBot: false,
    });
    sendSuccess(res, message, undefined, 201);
  },
} as const;
