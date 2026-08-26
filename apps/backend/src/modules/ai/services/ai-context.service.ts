import { NotFoundError } from '@wco/shared';
import type { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma.js';

/**
 * AI Context service — manages conversation context windows for
 * multi-turn AI interactions. Maintains a rolling message window,
 * entity accumulation, and intent history per thread.
 */

const MAX_WINDOW_SIZE = 20;
const DEFAULT_CONTEXT_TTL_HOURS = 24;

interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export class AIContextService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /** Create or retrieve a context for a thread. */
  async createContext(storeId: string, threadId: string, initialMessage?: string): Promise<Record<string, unknown>> {
    const existing = await this.db.aIConversationContext.findUnique({
      where: { storeId_threadId: { storeId, threadId } },
    });
    if (existing) return existing;

    const window: ContextMessage[] = [];
    if (initialMessage) {
      window.push({ role: 'user', content: initialMessage, timestamp: new Date().toISOString() });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + DEFAULT_CONTEXT_TTL_HOURS);

    return this.db.aIConversationContext.create({
      data: {
        storeId,
        threadId,
        window: window as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  }

  /** Get context for a thread. */
  async getContext(storeId: string, threadId: string): Promise<Record<string, unknown>> {
    const ctx = await this.db.aIConversationContext.findUnique({
      where: { storeId_threadId: { storeId, threadId } },
    });
    if (!ctx) throw new NotFoundError('AI context not found');
    return ctx;
  }

  /** Update context with a new message. */
  async updateContext(
    storeId: string,
    threadId: string,
    message: string,
    role: 'user' | 'assistant' | 'system' = 'user',
    metadata?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const existing = await this.db.aIConversationContext.findUnique({
      where: { storeId_threadId: { storeId, threadId } },
    });

    if (!existing) {
      return this.createContext(storeId, threadId, message);
    }

    const window = (existing.window as unknown as ContextMessage[]) ?? [];
    const newMessage: ContextMessage = {
      role,
      content: message,
      timestamp: new Date().toISOString(),
    };

    // Rolling window — drop oldest messages beyond limit
    const updatedWindow = [...window, newMessage].slice(-MAX_WINDOW_SIZE);

    // Extend TTL
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + DEFAULT_CONTEXT_TTL_HOURS);

    return this.db.aIConversationContext.update({
      where: { id: existing.id },
      data: {
        window: updatedWindow as unknown as Prisma.InputJsonValue,
        messageCount: { increment: 1 },
        expiresAt,
        updatedAt: new Date(),
      },
    });
  }

  /** Delete context for a thread. */
  async deleteContext(storeId: string, threadId: string): Promise<void> {
    const ctx = await this.db.aIConversationContext.findUnique({
      where: { storeId_threadId: { storeId, threadId } },
    });
    if (!ctx) throw new NotFoundError('AI context not found');
    await this.db.aIConversationContext.delete({ where: { id: ctx.id } });
  }

  /** Get context message history. */
  async getContextHistory(storeId: string, threadId: string, limit = 20): Promise<ContextMessage[]> {
    const ctx = await this.db.aIConversationContext.findUnique({
      where: { storeId_threadId: { storeId, threadId } },
    });
    if (!ctx) return [];
    const window = (ctx.window as unknown as ContextMessage[]) ?? [];
    return window.slice(-limit);
  }

  /** Update sentiment and intent history. */
  async updateMetadata(
    storeId: string,
    threadId: string,
    data: {
      sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
      intent?: string;
      entities?: Record<string, unknown>;
    },
  ): Promise<void> {
    const ctx = await this.db.aIConversationContext.findUnique({
      where: { storeId_threadId: { storeId, threadId } },
    });
    if (!ctx) return;

    const updateData: Record<string, unknown> = {};
    if (data.sentiment) updateData.sentiment = data.sentiment;
    if (data.intent) {
      const history = (ctx.intentHistory as string[]) ?? [];
      updateData.intentHistory = [...history.slice(-9), data.intent];
    }
    if (data.entities) {
      const existing = (ctx.entities as Record<string, unknown>) ?? {};
      updateData.entities = { ...existing, ...data.entities };
    }

    await this.db.aIConversationContext.update({
      where: { id: ctx.id },
      data: updateData as never,
    });
  }

  /** Clean up expired contexts. */
  async cleanupExpired(): Promise<number> {
    const result = await this.db.aIConversationContext.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}

export const aiContextService = new AIContextService();
