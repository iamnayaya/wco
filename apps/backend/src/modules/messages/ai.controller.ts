import { NotFoundError } from '@wco/shared';
import type { Request, Response } from 'express';


import { prisma } from '../../lib/prisma.js';
import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';

import { aiConfigService } from './services/ai-config.service.js';
import { aiIntentsService } from './services/ai-intents.service.js';
import { messagesService } from './services/messages.service.js';
import { detectIntent, detectLanguage, extractEntities, renderTemplate } from './services/nlp.service.js';
import { CANNED_REPLIES, GENERIC_REPLY } from './services/responder.service.js';
import { threadsService } from './services/threads.service.js';

/** AI auto-responder: configuration, taught intents, dry-run tools. */
export const aiController = {
  async getConfig(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await aiConfigService.getOrCreate(getStoreId(req)));
  },

  async updateConfig(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await aiConfigService.update(getStoreId(req), req.body));
  },

  /** "Delete" = safe-off (history intact, bot silent). */
  async deleteConfig(req: Request, res: Response): Promise<void> {
    await aiConfigService.remove(getStoreId(req));
    sendSuccess(res, { disabled: true });
  },

  async test(req: Request, res: Response): Promise<void> {
    const { message } = req.body as { message: string };
    sendSuccess(res, await aiConfigService.test(getStoreId(req), message));
  },

  // --- taught intents catalog -------------------------------------------------

  async listIntents(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await aiIntentsService.list(getStoreId(req)));
  },

  async createIntent(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await aiIntentsService.create(getStoreId(req), req.body), undefined, 201);
  },

  async updateIntent(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await aiIntentsService.update(getStoreId(req), req.params.intentId, req.body));
  },

  async deleteIntent(req: Request, res: Response): Promise<void> {
    await aiIntentsService.remove(getStoreId(req), req.params.intentId);
    sendSuccess(res, { deleted: true });
  },

  // --- stateless classifier utilities -------------------------------------------

  async detectIntent(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const { text } = req.body as { text: string };
    const custom = await prisma.aiIntent.findMany({ where: { storeId, isActive: true }, orderBy: { priority: 'desc' } });
    const match = detectIntent(text, custom);
    sendSuccess(res, {
      intent: match.intent,
      confidence: match.confidence,
      matchedKeywords: match.matchedKeywords,
      entities: extractEntities(text),
      language: detectLanguage(text),
    });
  },

  async extractEntities(req: Request, res: Response): Promise<void> {
    const { text } = req.body as { text: string };
    sendSuccess(res, extractEntities(text));
  },

  /**
   * Dry-run draft for a thread's latest inbound (or raw text) - identical
   * drafting rules as the live pipeline but nothing is sent or logged.
   */
  async generate(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const body = req.body as { threadId?: string; text?: string };
    let text = body.text ?? null;
    if (text === null && body.threadId !== undefined) {
      const thread = await threadsService.get(storeId, body.threadId);
      const lastInbound = await prisma.message.findFirst({
        where: { conversationId: thread.id, direction: 'INBOUND', body: { not: null } },
        orderBy: { createdAt: 'desc' },
      });
      text = lastInbound?.body ?? null;
    }
    if (text === null) throw new NotFoundError('Text or a thread with inbound messages');

    const [store, config] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId }, select: { name: true } }),
      aiConfigService.getOrCreate(storeId),
    ]);
    const custom = await prisma.aiIntent.findMany({ where: { storeId, isActive: true }, orderBy: { priority: 'desc' } });
    const match = detectIntent(text, custom);
    const entities = extractEntities(text);

    const hints = entities.productHints.slice(0, 3);
    const products =
      hints.length > 0
        ? await prisma.product.findMany({
            where: {
              storeId,
              status: 'ACTIVE',
              OR: hints.map((hint) => ({ name: { contains: hint, mode: 'insensitive' as const } })),
            },
            select: { name: true },
            take: 5,
          })
        : [];

    const canned = custom.find((ci) => ci.name === match.intent)?.cannedResponse;
    let template = GENERIC_REPLY;
    if (typeof canned === 'string') {
      template = canned;
    } else if (match.intent in CANNED_REPLIES) {
      template = CANNED_REPLIES[match.intent];
    }
    const storeName = store !== null ? store.name : 'our store';
    sendSuccess(res, {
      intent: match.intent,
      language: detectLanguage(text),
      groundedProducts: products.map((p) => p.name),
      draft: renderTemplate(template, {
        storeName,
        productList: products.length > 0 ? products.map((p) => p.name).join(', ') : 'our catalogue',
      }),
      source: 'heuristic',
      tone: config.tone,
    });
  },

  /** Manual bot send - agents pushing an approved AI-style reply. */
  async sendAsBot(req: Request, res: Response): Promise<void> {
    const { threadId, body } = req.body as { threadId: string; body: string };
    const message = await messagesService.send(getStoreId(req), threadId, {
      type: 'TEXT',
      body,
      sentByBot: true,
    });
    sendSuccess(res, message, undefined, 201);
  },
} as const;
