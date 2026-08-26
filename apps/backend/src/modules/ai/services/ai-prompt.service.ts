import { NotFoundError, ValidationError } from '@wco/shared';
import type { Prisma } from '@prisma/client';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';
import {
  PROMPT_TEMPLATES,
  getTemplateByName,
  renderTemplate as render,
  type PromptTemplate,
} from './prompt-templates.js';

/**
 * AI Prompt management service — CRUD for versioned prompt templates,
 * built-in template access, rendering, and feedback-driven optimization.
 */

export class AIPromptService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async create(storeId: string, data: {
    name: string;
    category?: string;
    systemPrompt: string;
    userTemplate: string;
    variables?: string[];
    language?: string;
    modelId?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<Record<string, unknown>> {
    const existing = await this.db.aIPrompt.findFirst({
      where: { storeId, name: data.name, isActive: true },
    });
    const version = existing ? existing.version + 1 : 1;

    // Auto-detect variables from template if not provided
    const variables = data.variables ?? this.extractVariables(data.userTemplate + ' ' + data.systemPrompt);

    const prompt = await this.db.aIPrompt.create({
      data: {
        storeId,
        name: data.name,
        category: (data.category as never) ?? 'CUSTOM',
        systemPrompt: data.systemPrompt,
        userTemplate: data.userTemplate,
        variables,
        language: data.language ?? 'en',
        version,
        modelId: data.modelId ?? null,
        temperature: data.temperature ?? null,
        maxTokens: data.maxTokens ?? null,
      },
    });

    return prompt;
  }

  async getById(storeId: string, id: string): Promise<Record<string, unknown>> {
    const prompt = await this.db.aIPrompt.findFirst({
      where: { id, storeId },
    });
    if (!prompt) throw new NotFoundError('AI prompt not found');
    return prompt;
  }

  async getByName(storeId: string, name: string): Promise<Record<string, unknown>> {
    const prompt = await this.db.aIPrompt.findFirst({
      where: { storeId, name, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!prompt) throw new NotFoundError('AI prompt not found');
    return prompt;
  }

  async list(storeId: string, page = 1, pageSize = 20, filters?: {
    category?: string;
    language?: string;
    isActive?: boolean;
  }): Promise<Record<string, unknown>[]> {
    const where: Prisma.AIPromptWhereInput = { storeId };
    if (filters?.category) where.category = filters.category as never;
    if (filters?.language) where.language = filters.language;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return this.db.aIPrompt.findMany({
      where,
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async count(storeId: string, filters?: Record<string, unknown>): Promise<number> {
    const where: Prisma.AIPromptWhereInput = { storeId };
    if (filters?.category) where.category = filters.category as never;
    if (filters?.language) where.language = filters.language as string;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive as boolean;
    return this.db.aIPrompt.count({ where });
  }

  async update(storeId: string, id: string, data: Partial<{
    systemPrompt: string;
    userTemplate: string;
    variables: string[];
    language: string;
    temperature: number;
    maxTokens: number;
    isActive: boolean;
    category: string;
  }>): Promise<Record<string, unknown>> {
    const existing = await this.getById(storeId, id);
    if (data.variables === undefined && (data.userTemplate || data.systemPrompt)) {
      data.variables = this.extractVariables(
        (data.userTemplate ?? existing.userTemplate as string) + ' ' +
        (data.systemPrompt ?? existing.systemPrompt as string),
      );
    }
    return this.db.aIPrompt.update({
      where: { id },
      data: data as never,
    });
  }

  async delete(storeId: string, id: string): Promise<void> {
    await this.getById(storeId, id);
    await this.db.aIPrompt.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Render a prompt template with provided variables. */
  render(template: string, variables: Record<string, string>): string {
    return render(template, variables);
  }

  /** Record prompt usage and update metrics. */
  async recordUsage(promptId: string, confidence: number): Promise<void> {
    await this.db.aIPrompt.update({
      where: { id: promptId },
      data: {
        usageCount: { increment: 1 },
        avgConfidence: {
          increment: 0, // will be computed via SQL
        },
      },
    });
    // Compute running average confidence
    await this.db.$executeRaw`
      UPDATE "ai_prompts"
      SET "avgConfidence" = (
        SELECT COALESCE(AVG("confidence"), 0)
        FROM "ai_responses"
        WHERE "promptId" = ${promptId}
      ),
      "totalFeedback" = (
        SELECT COUNT(*)::int
        FROM "ai_feedbacks"
        WHERE "responseId" IN (
          SELECT "id" FROM "ai_responses" WHERE "promptId" = ${promptId}
        )
      )
      WHERE "id" = ${promptId}
    `;
  }

  /** Get built-in templates. */
  getBuiltInTemplates(): readonly PromptTemplate[] {
    return PROMPT_TEMPLATES;
  }

  /** Get a built-in template by name. */
  getBuiltInTemplate(name: string): PromptTemplate | undefined {
    return getTemplateByName(name);
  }

  private extractVariables(text: string): string[] {
    const matches = text.match(/\{\{\s*(\w+)\s*\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/[{}]/g, '').trim()))];
  }
}

export const aiPromptService = new AIPromptService();
