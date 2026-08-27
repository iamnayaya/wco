import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';
import { aiConfidenceService } from './services/ai-confidence.service.js';
import { aiContextService } from './services/ai-context.service.js';
import { aiEmbeddingService } from './services/ai-embedding.service.js';
import { aiEntityService } from './services/ai-entity.service.js';
import { aiFeedbackService } from './services/ai-feedback.service.js';
import { aiGeneratorService } from './services/ai-generator.service.js';
import { aiIntentService } from './services/ai-intent.service.js';
import { aiPromptService } from './services/ai-prompt.service.js';
import { aiResponseService } from './services/ai-response.service.js';
import { complete, getRateLimits, llmAvailable } from './services/claude-api.service.js';
import { PROMPT_TEMPLATES } from './services/prompt-templates.js';

/** AI Engine controller — all endpoints for prompts, responses, embeddings, context, feedback, confidence, intents, entities, and generators. */
export const aiController = {
  // ─── Health ─────────────────────────────────────────────────────
  async health(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, {
      llmAvailable: llmAvailable(),
      rateLimits: getRateLimits(),
      builtInTemplates: PROMPT_TEMPLATES.length,
    });
  },

  // ─── Prompt Management ──────────────────────────────────────────
  async createPrompt(req: Request, res: Response): Promise<void> {
    const prompt = await aiPromptService.create(getStoreId(req), req.body);
    sendSuccess(res, prompt, undefined, 201);
  },

  async getPromptById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await aiPromptService.getById(getStoreId(req), req.params.id));
  },

  async getPromptByName(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await aiPromptService.getByName(getStoreId(req), req.params.name));
  },

  async listPrompts(req: Request, res: Response): Promise<void> {
    const q = req.query as { page?: string; pageSize?: string; category?: string; language?: string; isActive?: string };
    const page = Number(q.page) || 1;
    const pageSize = Number(q.pageSize) || 20;
    const [items, total] = await Promise.all([
      aiPromptService.list(getStoreId(req), page, pageSize, {
        category: q.category,
        language: q.language,
        isActive: q.isActive !== undefined ? q.isActive === 'true' : undefined,
      }),
      aiPromptService.count(getStoreId(req), {
        category: q.category,
        language: q.language,
        isActive: q.isActive !== undefined ? q.isActive === 'true' : undefined,
      }),
    ]);
    sendSuccess(res, items, paginationMeta(page, pageSize, total));
  },

  async updatePrompt(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await aiPromptService.update(getStoreId(req), req.params.id, req.body));
  },

  async deletePrompt(req: Request, res: Response): Promise<void> {
    await aiPromptService.delete(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  },

  async renderPrompt(req: Request, res: Response): Promise<void> {
    const prompt = await aiPromptService.getById(getStoreId(req), req.params.id);
    const rendered = aiPromptService.render(prompt.systemPrompt as string, req.body.variables);
    const renderedUser = aiPromptService.render(prompt.userTemplate as string, req.body.variables);
    sendSuccess(res, { systemPrompt: rendered, userPrompt: renderedUser });
  },

  async getBuiltInTemplates(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, PROMPT_TEMPLATES.map((t) => ({
      name: t.name,
      category: t.category,
      variables: t.variables,
      language: t.language,
    })));
  },

  // ─── Response Generation ────────────────────────────────────────
  async generateResponse(req: Request, res: Response): Promise<void> {
    const result = await aiResponseService.generate(getStoreId(req), req.body);
    sendSuccess(res, result);
  },

  async listResponses(req: Request, res: Response): Promise<void> {
    const q = req.query as { page?: string; pageSize?: string; promptId?: string; modelId?: string; cached?: string; escalated?: string; dateFrom?: string; dateTo?: string };
    const page = Number(q.page) || 1;
    const pageSize = Number(q.pageSize) || 20;
    const [items, total] = await Promise.all([
      aiResponseService.list(getStoreId(req), page, pageSize, {
        promptId: q.promptId,
        modelId: q.modelId,
        cached: q.cached !== undefined ? q.cached === 'true' : undefined,
        escalated: q.escalated !== undefined ? q.escalated === 'true' : undefined,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
      }),
      aiResponseService.count(getStoreId(req), {
        promptId: q.promptId,
        cached: q.cached !== undefined ? q.cached === 'true' : undefined,
      }),
    ]);
    sendSuccess(res, items, paginationMeta(page, pageSize, total));
  },

  async getCachedResponse(req: Request, res: Response): Promise<void> {
    const q = req.query as { key?: string };
    const cached = await aiResponseService.getCached(getStoreId(req), q.key ?? '');
    sendSuccess(res, { cached, found: cached !== null });
  },

  async invalidateCache(req: Request, res: Response): Promise<void> {
    const q = req.query as { key?: string };
    await aiResponseService.invalidateCache(getStoreId(req), q.key ?? '');
    sendSuccess(res, { invalidated: true });
  },

  // ─── Embeddings ─────────────────────────────────────────────────
  async generateEmbedding(req: Request, res: Response): Promise<void> {
    const { entityType, entityId, text, metadata } = req.body;
    const result = await aiEmbeddingService.storeEmbedding(
      getStoreId(req), entityType, entityId, text, undefined, metadata,
    );
    sendSuccess(res, result, undefined, 201);
  },

  async searchEmbeddings(req: Request, res: Response): Promise<void> {
    const { query, entityType, limit, threshold } = req.body;
    const results = await aiEmbeddingService.searchEmbeddings(
      getStoreId(req), query, entityType, limit, threshold,
    );
    sendSuccess(res, results);
  },

  async deleteEmbedding(req: Request, res: Response): Promise<void> {
    await aiEmbeddingService.deleteEmbedding(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  },

  // ─── Context Management ─────────────────────────────────────────
  async createContext(req: Request, res: Response): Promise<void> {
    const ctx = await aiContextService.createContext(
      getStoreId(req), req.body.threadId, req.body.initialMessage,
    );
    sendSuccess(res, ctx, undefined, 201);
  },

  async getContext(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await aiContextService.getContext(getStoreId(req), req.params.threadId));
  },

  async updateContext(req: Request, res: Response): Promise<void> {
    const ctx = await aiContextService.updateContext(
      getStoreId(req), req.params.threadId, req.body.message, req.body.role, req.body.metadata,
    );
    sendSuccess(res, ctx);
  },

  async deleteContext(req: Request, res: Response): Promise<void> {
    await aiContextService.deleteContext(getStoreId(req), req.params.threadId);
    sendSuccess(res, { deleted: true });
  },

  async getContextHistory(req: Request, res: Response): Promise<void> {
    const q = req.query as { limit?: string };
    const history = await aiContextService.getContextHistory(
      getStoreId(req), req.params.threadId, Number(q.limit) || 20,
    );
    sendSuccess(res, history);
  },

  // ─── Feedback ───────────────────────────────────────────────────
  async createFeedback(req: Request, res: Response): Promise<void> {
    const feedback = await aiFeedbackService.createFeedback(getStoreId(req), req.body);
    sendSuccess(res, feedback, undefined, 201);
  },

  async getFeedbackByResponse(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await aiFeedbackService.getFeedbackByResponse(getStoreId(req), req.params.id));
  },

  async listFeedback(req: Request, res: Response): Promise<void> {
    const q = req.query as { page?: string; pageSize?: string; type?: string; resolved?: string; dateFrom?: string; dateTo?: string };
    const page = Number(q.page) || 1;
    const pageSize = Number(q.pageSize) || 20;
    const [items, total] = await Promise.all([
      aiFeedbackService.listFeedback(getStoreId(req), page, pageSize, {
        type: q.type,
        resolved: q.resolved !== undefined ? q.resolved === 'true' : undefined,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
      }),
      aiFeedbackService.countFeedback(getStoreId(req), {
        type: q.type,
        resolved: q.resolved !== undefined ? q.resolved === 'true' : undefined,
      }),
    ]);
    sendSuccess(res, items, paginationMeta(page, pageSize, total));
  },

  async analyzeFeedback(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, await aiFeedbackService.analyzeFeedback(getStoreId(_req)));
  },

  // ─── Confidence ─────────────────────────────────────────────────
  async calculateConfidence(req: Request, res: Response): Promise<void> {
    const { response, context, useCase } = req.body;
    const confidence = aiConfidenceService.calculateConfidence(response, context);
    const threshold = await aiConfidenceService.getThreshold(getStoreId(req), useCase ?? 'auto_response');
    const escalated = aiConfidenceService.shouldEscalate(confidence, threshold);
    sendSuccess(res, { confidence, threshold, escalated, useCase });
  },

  async getConfidenceThreshold(req: Request, res: Response): Promise<void> {
    const q = req.query as { useCase?: string };
    const thresholds = await aiConfidenceService.listThresholds(getStoreId(req));
    if (q.useCase) {
      const found = thresholds.find((t) => t.useCase === q.useCase);
      sendSuccess(res, found ?? { useCase: q.useCase, threshold: 0.6 });
    } else {
      sendSuccess(res, thresholds);
    }
  },

  async updateConfidenceThreshold(req: Request, res: Response): Promise<void> {
    await aiConfidenceService.updateThreshold(getStoreId(req), req.body.useCase, req.body.threshold);
    sendSuccess(res, { updated: true, useCase: req.body.useCase, threshold: req.body.threshold });
  },

  // ─── Intent Detection ───────────────────────────────────────────
  async detectIntent(req: Request, res: Response): Promise<void> {
    const result = await aiIntentService.detectIntent(
      getStoreId(req), req.body.message, req.body.context, req.body.language,
    );
    sendSuccess(res, result);
  },

  async trainIntentDetector(req: Request, res: Response): Promise<void> {
    const result = await aiIntentService.trainIntentDetector(getStoreId(req), req.body.intents);
    sendSuccess(res, result);
  },

  async evaluateIntentDetector(req: Request, res: Response): Promise<void> {
    const result = await aiIntentService.evaluateIntentDetector(getStoreId(req), req.body.testCases);
    sendSuccess(res, result);
  },

  async listIntents(req: Request, res: Response): Promise<void> {
    const q = req.query as { page?: string; pageSize?: string; isActive?: string };
    const page = Number(q.page) || 1;
    const pageSize = Number(q.pageSize) || 20;
    const isActive = q.isActive !== undefined ? q.isActive === 'true' : undefined;
    const [items, total] = await Promise.all([
      aiIntentService.listIntents(getStoreId(req), page, pageSize, isActive),
      aiIntentService.countIntents(getStoreId(req), isActive),
    ]);
    sendSuccess(res, items, paginationMeta(page, pageSize, total));
  },

  // ─── Entity Extraction ──────────────────────────────────────────
  async extractEntities(req: Request, res: Response): Promise<void> {
    const result = await aiEntityService.extractEntities(
      req.body.message, req.body.intent, req.body.context,
    );
    sendSuccess(res, result);
  },

  async trainEntityExtractor(req: Request, res: Response): Promise<void> {
    const result = await aiEntityService.trainEntityExtractor(
      getStoreId(req), req.body.entityType, req.body.examples,
    );
    sendSuccess(res, result);
  },

  async evaluateEntityExtractor(req: Request, res: Response): Promise<void> {
    const result = await aiEntityService.evaluateEntityExtractor(
      req.body.entityType, req.body.testCases,
    );
    sendSuccess(res, result);
  },

  async listEntityTypes(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, aiEntityService.listEntityTypes());
  },

  // ─── Response Generator ─────────────────────────────────────────
  async generateAutoResponse(req: Request, res: Response): Promise<void> {
    const result = await aiGeneratorService.generateAutoResponse(getStoreId(req), req.body);
    sendSuccess(res, result);
  },

  async generateProductDescription(req: Request, res: Response): Promise<void> {
    const result = await aiGeneratorService.generateProductDescription(getStoreId(req), req.body);
    sendSuccess(res, result);
  },

  async generatePricingSuggestion(req: Request, res: Response): Promise<void> {
    const result = await aiGeneratorService.generatePricingSuggestion(getStoreId(req), req.body);
    sendSuccess(res, result);
  },

  async generateCustomerSegment(req: Request, res: Response): Promise<void> {
    const result = await aiGeneratorService.generateCustomerSegment(getStoreId(req), req.body);
    sendSuccess(res, result);
  },

  async generateSalesForecast(req: Request, res: Response): Promise<void> {
    const result = await aiGeneratorService.generateSalesForecast(getStoreId(req), req.body);
    sendSuccess(res, result);
  },

  async generateFraudDetection(req: Request, res: Response): Promise<void> {
    const result = await aiGeneratorService.generateFraudDetection(getStoreId(req), req.body);
    sendSuccess(res, result);
  },

  async generateDeliveryTimePrediction(req: Request, res: Response): Promise<void> {
    const result = await aiGeneratorService.generateDeliveryTimePrediction(getStoreId(req), req.body);
    sendSuccess(res, result);
  },

  async generateInsights(req: Request, res: Response): Promise<void> {
    const result = await aiGeneratorService.generateInsights(getStoreId(req), req.body);
    sendSuccess(res, result);
  },

  async generateReport(req: Request, res: Response): Promise<void> {
    const result = await aiGeneratorService.generateReport(getStoreId(req), req.body);
    sendSuccess(res, result);
  },
} as const;
