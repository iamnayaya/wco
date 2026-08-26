import type { AiConfiguration } from '@prisma/client';

import { prisma } from '../../../lib/prisma.js';

import {
  detectIntent,
  detectLanguage,
  extractEntities,
  renderTemplate,
  scoreConfidence,
} from './nlp.service.js';

/**
 * Per-store AI configuration. The row is created lazily on first read so the
 * dashboard always has something to render and PUT is a plain upsert.
 */

const DEFAULT_WORKING_HOURS = {
  start: '09:00',
  end: '18:00',
  days: [1, 2, 3, 4, 5],
};

/** Intents that always bypass the bot and page a human. */
const HARD_ESCALATION_INTENTS = ['COMPLAINT', 'REFUND', 'HUMAN_REQUEST'];

export interface AiTestResult {
  readonly intent: string;
  readonly confidence: number;
  readonly entities: Record<string, unknown>;
  readonly language: string;
  readonly withinSessionWindow: boolean;
  readonly wouldEscalate: boolean;
  readonly draftReply: string;
}

export class AiConfigService {
  async getOrCreate(storeId: string): Promise<AiConfiguration> {
    const existing = await prisma.aiConfiguration.findUnique({ where: { storeId } });
    if (existing) return existing;
    return prisma.aiConfiguration.create({
      data: {
        storeId,
        isEnabled: false,
        autoReplyEnabled: true,
        tone: 'FRIENDLY',
        languages: ['en', 'pcm'],
        workingHours: DEFAULT_WORKING_HOURS,
        escalationKeywords: [],
        confidenceThreshold: 0.6,
      },
    });
  }

  async update(
    storeId: string,
    data: Record<string, unknown>,
  ): Promise<AiConfiguration> {
    await this.getOrCreate(storeId);
    return prisma.aiConfiguration.update({ where: { storeId }, data });
  }

  /** Disabling keeps history but stops all bot sends immediately. */
  async remove(storeId: string): Promise<void> {
    const existing = await prisma.aiConfiguration.findUnique({ where: { storeId } });
    if (!existing) return;
    await prisma.aiConfiguration.update({
      where: { storeId },
      data: { isEnabled: false, autoReplyEnabled: false },
    });
  }

  /**
   * POST /ai-configurations/test - dry-run classifier. No conversation rows
   * are touched; the session window is reported as open because there is no
   * real thread to measure against.
   */
  async test(storeId: string, message: string): Promise<AiTestResult> {
    const config = await this.getOrCreate(storeId);
    const customIntents = await prisma.aiIntent.findMany({
      where: { storeId, isActive: true },
      orderBy: { priority: 'desc' },
    });
    const match = detectIntent(message, customIntents);
    const entities = extractEntities(message);
    const language = detectLanguage(message);
    const confidence = scoreConfidence(match.confidence, language, Object.keys(entities).length > 0);

    const keywordHit = config.escalationKeywords.some((k) => message.toLowerCase().includes(k.toLowerCase()));
    const wouldEscalate =
      !config.isEnabled ||
      !config.autoReplyEnabled ||
      keywordHit ||
      HARD_ESCALATION_INTENTS.includes(match.intent) ||
      confidence < Number(config.confidenceThreshold);

    return {
      intent: match.intent,
      confidence,
      entities: entities as unknown as Record<string, unknown>,
      language,
      withinSessionWindow: true,
      wouldEscalate,
      draftReply: renderTemplate(
        'Thanks for reaching out! An agent will confirm the details shortly.',
        {},
      ),
    };
  }
}

export const aiConfigService = new AiConfigService();
