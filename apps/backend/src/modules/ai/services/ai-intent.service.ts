import type { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma.js';
import { complete } from './claude-api.service.js';
import { getTemplateByName, renderTemplate } from './prompt-templates.js';

/**
 * AI Intent detection service — enhanced intent detection combining
 * LLM-based classification with the existing NLP heuristics.
 * Supports training data evaluation and store-specific intents.
 */

interface DetectedIntent {
  intent: string;
  confidence: number;
  reasoning?: string;
  source: 'llm' | 'heuristic' | 'custom';
  matchedKeywords?: string[];
}

export class AIIntentService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /** Detect intent using LLM + heuristic fallback. */
  async detectIntent(
    storeId: string,
    message: string,
    context?: Record<string, unknown>,
    language?: string,
  ): Promise<DetectedIntent> {
    // Load custom intents
    const customIntents = await this.db.aiIntent.findMany({
      where: { storeId, isActive: true },
      orderBy: { priority: 'desc' },
    });

    // Try LLM first
    try {
      const template = getTemplateByName('intent-detection');
      if (template) {
        const userPrompt = renderTemplate(template.userTemplate, { message });
        const result = await complete({
          systemPrompt: template.systemPrompt,
          userPrompt,
          temperature: template.temperature,
          maxTokens: template.maxTokens,
        });

        // Parse JSON response
        try {
          const parsed = JSON.parse(result.text) as {
            intent?: string;
            confidence?: number;
            reasoning?: string;
          };
          if (parsed.intent && typeof parsed.confidence === 'number') {
            // Check if intent matches a custom intent
            const customMatch = customIntents.find(
              (ci) => ci.name.toUpperCase() === parsed.intent!.toUpperCase(),
            );
            return {
              intent: parsed.intent,
              confidence: parsed.confidence,
              reasoning: parsed.reasoning,
              source: customMatch ? 'custom' : 'llm',
            };
          }
        } catch {
          // JSON parse failed — fall through to heuristic
        }
      }
    } catch {
      // LLM unavailable — fall through to heuristic
    }

    // Fallback: check custom intents by keywords
    const normalized = message.toLowerCase();
    for (const intent of customIntents) {
      const hit = intent.keywords.find((k) => k.length > 0 && normalized.includes(k.toLowerCase()));
      if (hit) {
        return {
          intent: intent.name,
          confidence: 0.9,
          source: 'custom',
          matchedKeywords: [hit],
        };
      }
    }

    // Final fallback: generic heuristic
    return {
      intent: 'UNKNOWN',
      confidence: 0.3,
      source: 'heuristic',
    };
  }

  /** Train the intent detector with sample data. */
  async trainIntentDetector(storeId: string, intents: Array<{
    name: string;
    examples: string[];
    keywords?: string[];
  }>): Promise<Record<string, unknown>> {
    const results: Array<{ name: string; status: string; intentId?: string }> = [];

    for (const intent of intents) {
      // Upsert the intent
      const existing = await this.db.aiIntent.findFirst({
        where: { storeId, name: intent.name },
      });

      if (existing) {
        await this.db.aiIntent.update({
          where: { id: existing.id },
          data: {
            keywords: intent.keywords ?? existing.keywords,
            sampleUtterances: intent.examples,
          },
        });
        results.push({ name: intent.name, status: 'updated', intentId: existing.id });
      } else {
        const created = await this.db.aiIntent.create({
          data: {
            storeId,
            name: intent.name,
            keywords: intent.keywords ?? [],
            sampleUtterances: intent.examples,
          },
        });
        results.push({ name: intent.name, status: 'created', intentId: created.id });
      }
    }

    return { processed: results.length, results };
  }

  /** Evaluate intent detection accuracy with test cases. */
  async evaluateIntentDetector(storeId: string, testCases: Array<{
    message: string;
    expectedIntent: string;
  }>): Promise<Record<string, unknown>> {
    let correct = 0;
    const details: Array<{
      message: string;
      expected: string;
      detected: string;
      confidence: number;
      correct: boolean;
    }> = [];

    for (const tc of testCases) {
      const result = await this.detectIntent(storeId, tc.message);
      const isCorrect = result.intent.toUpperCase() === tc.expectedIntent.toUpperCase();
      if (isCorrect) correct++;

      details.push({
        message: tc.message.slice(0, 100),
        expected: tc.expectedIntent,
        detected: result.intent,
        confidence: result.confidence,
        correct: isCorrect,
      });
    }

    return {
      accuracy: testCases.length > 0 ? correct / testCases.length : 0,
      correct,
      total: testCases.length,
      details,
    };
  }

  /** List intents for a store. */
  async listIntents(storeId: string, page = 1, pageSize = 20, isActive?: boolean): Promise<Record<string, unknown>[]> {
    const where: Prisma.AiIntentWhereInput = { storeId };
    if (isActive !== undefined) where.isActive = isActive;
    return this.db.aiIntent.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async countIntents(storeId: string, isActive?: boolean): Promise<number> {
    const where: Prisma.AiIntentWhereInput = { storeId };
    if (isActive !== undefined) where.isActive = isActive;
    return this.db.aiIntent.count({ where });
  }
}

export const aiIntentService = new AIIntentService();
