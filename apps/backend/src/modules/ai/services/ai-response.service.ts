import type { Prisma } from '@prisma/client';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';
import { getRedis } from '../../../lib/redis.js';

import { complete, type LLMRequest, type LLMResult } from './claude-api.service.js';
import { aiPromptService } from './ai-prompt.service.js';

/**
 * AI Response service — orchestrates LLM calls with caching, logging,
 * and metrics. Every response is persisted for audit and learning.
 */

const CACHE_PREFIX = 'ai:response:';
const DEFAULT_CACHE_TTL = 3600; // 1 hour

function hashInput(systemPrompt: string, userPrompt: string): string {
  const data = systemPrompt + '|||' + userPrompt;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0;
  }
  return `h_${Math.abs(hash).toString(36)}`;
}

export class AIResponseService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /** Generate an AI response via LLM with caching and logging. */
  async generate(storeId: string, input: {
    promptId?: string;
    systemPrompt?: string;
    userPrompt: string;
    modelId?: string;
    threadId?: string;
    variables?: Record<string, string>;
    temperature?: number;
    maxTokens?: number;
    useCache?: boolean;
    context?: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    let systemPrompt = input.systemPrompt;
    let userPrompt = input.userPrompt;
    let promptRecord: Record<string, unknown> | null = null;

    // Resolve prompt from ID or built-in template
    if (input.promptId) {
      promptRecord = await aiPromptService.getById(storeId, input.promptId) as Record<string, unknown>;
      systemPrompt = promptRecord.systemPrompt as string;
      userPrompt = input.variables
        ? aiPromptService.render(promptRecord.userTemplate as string, input.variables)
        : promptRecord.userTemplate as string;
    }

    if (!systemPrompt) {
      systemPrompt = 'You are a helpful AI assistant for a WhatsApp commerce store. Be concise and helpful.';
    }

    // Check cache
    const cacheKey = `${CACHE_PREFIX}${storeId}:${hashInput(systemPrompt, userPrompt)}`;
    if (input.useCache !== false) {
      try {
        const cached = await getRedis().get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as Record<string, unknown>;
          parsed.cached = true;
          return parsed;
        }
      } catch {
        // Cache miss or Redis down — proceed to LLM
      }
    }

    const startedAt = Date.now();
    let result: LLMResult;
    try {
      result = await complete({
        systemPrompt,
        userPrompt,
        model: input.modelId,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      });
    } catch (err) {
      logger.error('ai.response.failed', {
        storeId,
        error: (err as Error).message,
        latencyMs: Date.now() - startedAt,
      });
      throw err;
    }

    // Calculate basic confidence
    const confidence = this.estimateConfidence(result, input.context);

    // Persist response
    const responseRecord = await this.db.aIResponse.create({
      data: {
        storeId,
        promptId: input.promptId ?? null,
        modelId: null,
        threadId: input.threadId ?? null,
        inputHash: hashInput(systemPrompt, userPrompt),
        systemPrompt,
        userPrompt,
        output: result.text,
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        latencyMs: result.latencyMs,
        confidence,
        cached: false,
        metadata: JSON.stringify(input.context ?? {}),
      },
    });

    // Update prompt usage metrics
    if (input.promptId) {
      aiPromptService.recordUsage(input.promptId, confidence).catch(() => undefined);
    }

    // Cache the response
    if (input.useCache !== false && result.text.length > 0) {
      try {
        const cacheData = { ...responseRecord, cached: false };
        await getRedis().set(cacheKey, JSON.stringify(cacheData), 'EX', DEFAULT_CACHE_TTL);
      } catch {
        // Non-critical — log and continue
      }
    }

    // Log metrics
    logger.info('ai.response.generated', {
      storeId,
      provider: result.provider,
      model: result.model,
      tokensInput: result.tokensInput,
      tokensOutput: result.tokensOutput,
      latencyMs: result.latencyMs,
      confidence,
      cached: false,
    });

    return responseRecord;
  }

  /** Get a cached response by key. */
  async getCached(storeId: string, key: string): Promise<Record<string, unknown> | null> {
    try {
      const cached = await getRedis().get(`${CACHE_PREFIX}${storeId}:${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  /** Invalidate cached response. */
  async invalidateCache(storeId: string, key: string): Promise<void> {
    try {
      await getRedis().del(`${CACHE_PREFIX}${storeId}:${key}`);
    } catch {
      // Non-critical
    }
  }

  /** List responses with filters. */
  async list(storeId: string, page = 1, pageSize = 20, filters?: {
    promptId?: string;
    modelId?: string;
    cached?: boolean;
    escalated?: boolean;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<Record<string, unknown>[]> {
    const where: Prisma.AIResponseWhereInput = { storeId };
    if (filters?.promptId) where.promptId = filters.promptId;
    if (filters?.modelId) where.modelId = filters.modelId;
    if (filters?.cached !== undefined) where.cached = filters.cached;
    if (filters?.escalated !== undefined) where.escalated = filters.escalated;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    return this.db.aIResponse.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { prompt: { select: { name: true, category: true } } },
    });
  }

  async count(storeId: string, filters?: Record<string, unknown>): Promise<number> {
    const where: Prisma.AIResponseWhereInput = { storeId };
    if (filters?.promptId) where.promptId = filters.promptId as string;
    if (filters?.cached !== undefined) where.cached = filters.cached as boolean;
    return this.db.aIResponse.count({ where });
  }

  private estimateConfidence(result: LLMResult, context?: Record<string, unknown>): number {
    let confidence = 0.7; // base
    // Longer outputs tend to be more thorough
    if (result.tokensOutput > 50) confidence += 0.05;
    if (result.tokensOutput > 150) confidence += 0.05;
    // Lower latency may indicate a simple, confident answer
    if (result.latencyMs < 2000) confidence += 0.05;
    // Check for hedging language
    const lower = result.text.toLowerCase();
    if (lower.includes('i think') || lower.includes('maybe') || lower.includes('not sure')) {
      confidence -= 0.1;
    }
    if (lower.includes('definitely') || lower.includes('certainly')) {
      confidence += 0.05;
    }
    return Math.max(0.1, Math.min(0.99, confidence));
  }
}

export const aiResponseService = new AIResponseService();
