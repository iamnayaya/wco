import { NotFoundError } from '@wco/shared';
import type { Request, Response } from 'express';


import { env } from '../../config/env.js';
import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';
import { toCsv } from '../customers/csv.util.js';

import { attachmentsService, type UploadInput } from './services/attachments.service.js';
import { messagesService } from './services/messages.service.js';
import { responderService } from './services/responder.service.js';
import { statsService } from './services/stats.service.js';
import { threadsService } from './services/threads.service.js';
import { assertIngressAllowed, requireNonEmptyBody } from './services/webhook.service.js';

function setCsvHeaders(res: Response, filename: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

/** Store-wide message feed: search, CSV export, sends, webhook ingress. */
export const messagesController = {
  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as Record<string, unknown> & { page: number; pageSize: number };
    const result = await messagesService.listStoreWide(getStoreId(req), query as never);
    sendSuccess(res, result.items, {
      pagination: paginationMeta(query.page, query.pageSize, result.meta.totalItems),
    });
  },

  async search(req: Request, res: Response): Promise<void> {
    const query = req.query as Record<string, unknown> & { page: number; pageSize: number; q: string };
    const result = await messagesService.search(getStoreId(req), query.q, query as never);
    sendSuccess(res, result.items, {
      pagination: paginationMeta(query.page, query.pageSize, result.meta.totalItems),
      q: query.q,
    });
  },

  /** CSV export - compliance-friendly audit dump (BOM included by toCsv). */
  async exportCsv(req: Request, res: Response): Promise<void> {
    const query = req.query as Record<string, unknown>;
    const result = await messagesService.listStoreWide(getStoreId(req), {
      ...(query as object),
      page: 1,
      pageSize: 1000,
      sort: 'createdAt_asc',
    } as never);
    const csv = toCsv(
      ['createdAt', 'threadId', 'direction', 'type', 'status', 'sentByBot', 'body'],
      result.items.map((m) => ({
        createdAt: m.createdAt.toISOString(),
        threadId: m.conversationId,
        direction: m.direction,
        type: m.type,
        status: m.status,
        sentByBot: m.sentByBot,
        body: m.body ?? '',
      })),
    );
    setCsvHeaders(res, `messages-${new Date().toISOString().slice(0, 10)}.csv`);
    res.status(200).send(csv);
  },

  /**
   * Send to a thread id OR a customer id (auto-creates the thread) -
   * the two variants arrive via sendMessageSchema's union.
   */
  async send(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const body = req.body as {
      threadId?: string;
      customerId?: string;
      type: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'TEMPLATE';
      body?: string;
      mediaUrl?: string;
      templateName?: string;
    };
    const threadId =
      body.threadId ??
      (await threadsService.create(storeId, body.customerId ?? '')).id;
    const message = await messagesService.send(storeId, threadId, {
      type: body.type,
      body: body.body,
      mediaUrl: body.mediaUrl,
      templateName: body.templateName,
      sentByBot: false,
    });
    sendSuccess(res, message, undefined, 201);
  },

  /**
   * Testing/backfill ingress. Same pipeline as the signed Meta webhook but
   * guarded by WEBHOOK_INGRESS_KEY instead of HMAC.
   */
  async receive(req: Request, res: Response): Promise<void> {
    assertIngressAllowed(req.headers as Record<string, unknown>, env.NODE_ENV);
    const body = req.body as {
      storePhoneNumberId: string;
      fromPhone: string;
      waMessageId: string;
      type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'template' | 'interactive';
      body?: string | null;
      mediaUrl?: string | null;
      timestamp?: Date;
    };
    const inboundBody = body.body ?? null;
    const inboundMediaUrl = body.mediaUrl ?? null;
    requireNonEmptyBody({ body: inboundBody, mediaUrl: inboundMediaUrl, type: body.type });
    const result = await responderService.ingestAndDispatch({
      storePhoneNumberId: body.storePhoneNumberId,
      waMessageId: body.waMessageId,
      fromPhone: body.fromPhone,
      type: body.type,
      body: inboundBody,
      mediaUrl: inboundMediaUrl,
      timestamp: body.timestamp ?? new Date(),
    });
    sendSuccess(res, result, undefined, 201);
  },

  async uploadAttachment(req: Request, res: Response): Promise<void> {
    const file = req.file;
    if (!file) throw new NotFoundError('File (multipart field "file")');
    const input: UploadInput = {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    };
    const query = req.query as { messageId?: string; threadId?: string };
    const messageId = (req.params.id as string) ?? query.messageId;
    const attachment = await attachmentsService.create(getStoreId(req), input, { ...query, messageId });
    sendSuccess(res, attachment, undefined, 201);
  },

  async listAttachments(req: Request, res: Response): Promise<void> {
    const attachments = await attachmentsService.listForMessage(getStoreId(req), req.params.id);
    sendSuccess(res, attachments);
  },

  async get(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await messagesService.getById(getStoreId(req), req.params.id));
  },

  async update(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await messagesService.updateById(getStoreId(req), req.params.id, req.body));
  },

  async remove(req: Request, res: Response): Promise<void> {
    await messagesService.removeById(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  },

  async stats(req: Request, res: Response): Promise<void> {
    const query = req.query as { from?: string; to?: string };
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    sendSuccess(res, await statsService.getStats(getStoreId(req), from, to));
  },
} as const;
