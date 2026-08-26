import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { aiController } from './ai.controller.js';
import {
  createAIModelSchema,
  aiModelParams,
  createAIPromptSchema,
  promptParams,
  promptNameParams,
  renderPromptSchema,
  listPromptsQuery,
  generateResponseSchema,
  listResponsesQuery,
  generateEmbeddingSchema,
  searchEmbeddingsSchema,
  embeddingParams,
  createContextSchema,
  updateContextSchema,
  contextParams,
  contextHistoryQuery,
  createFeedbackSchema,
  listFeedbackQuery,
  feedbackResponseParams,
  calculateConfidenceSchema,
  confidenceThresholdQuery,
  updateConfidenceThresholdSchema,
  detectIntentSchema,
  trainIntentSchema,
  evaluateIntentSchema,
  listIntentsQuery,
  extractEntitiesSchema,
  trainEntitySchema,
  evaluateEntitySchema,
  generateAutoResponseSchema,
  generateProductDescriptionSchema,
  generatePricingSuggestionSchema,
  generateCustomerSegmentSchema,
  generateSalesForecastSchema,
  generateFraudDetectionSchema,
  generateDeliveryPredictionSchema,
  generateInsightsSchema,
  generateReportSchema,
} from './ai.dto.js';

/**
 * AI Engine routes — /api/v1/ai/*
 *
 * All routes require authentication + tenant scope.
 * Write operations require store:write permission.
 */
export const aiEngineRouter: Router = Router();
aiEngineRouter.use(authenticate(), tenantScope());

// ─── Health ─────────────────────────────────────────────────────────
aiEngineRouter.get('/health', asyncHandler(aiController.health));

// ─── Prompt Management ──────────────────────────────────────────────
aiEngineRouter.get(
  '/prompts/built-in',
  asyncHandler(aiController.getBuiltInTemplates),
);

aiEngineRouter.get(
  '/prompts',
  validate({ query: listPromptsQuery }),
  asyncHandler(aiController.listPrompts),
);

aiEngineRouter.post(
  '/prompts',
  requirePermission('store:write'),
  validate({ body: createAIPromptSchema }),
  asyncHandler(aiController.createPrompt),
);

aiEngineRouter.get(
  '/prompts/name/:name',
  validate({ params: promptNameParams }),
  asyncHandler(aiController.getPromptByName),
);

aiEngineRouter.get(
  '/prompts/:id',
  validate({ params: promptParams }),
  asyncHandler(aiController.getPromptById),
);

aiEngineRouter.put(
  '/prompts/:id',
  requirePermission('store:write'),
  validate({ params: promptParams, body: createAIPromptSchema.partial() }),
  asyncHandler(aiController.updatePrompt),
);

aiEngineRouter.delete(
  '/prompts/:id',
  requirePermission('store:write'),
  validate({ params: promptParams }),
  asyncHandler(aiController.deletePrompt),
);

aiEngineRouter.post(
  '/prompts/:id/render',
  requirePermission('store:write'),
  validate({ params: promptParams, body: renderPromptSchema }),
  asyncHandler(aiController.renderPrompt),
);

// ─── Response Generation ────────────────────────────────────────────
aiEngineRouter.post(
  '/responses/generate',
  requirePermission('store:write'),
  validate({ body: generateResponseSchema }),
  asyncHandler(aiController.generateResponse),
);

aiEngineRouter.get(
  '/responses',
  validate({ query: listResponsesQuery }),
  asyncHandler(aiController.listResponses),
);

aiEngineRouter.get(
  '/responses/cached',
  asyncHandler(aiController.getCachedResponse),
);

aiEngineRouter.delete(
  '/responses/cached',
  requirePermission('store:write'),
  asyncHandler(aiController.invalidateCache),
);

// ─── Embeddings ─────────────────────────────────────────────────────
aiEngineRouter.post(
  '/embeddings/generate',
  requirePermission('store:write'),
  validate({ body: generateEmbeddingSchema }),
  asyncHandler(aiController.generateEmbedding),
);

aiEngineRouter.post(
  '/embeddings/search',
  validate({ body: searchEmbeddingsSchema }),
  asyncHandler(aiController.searchEmbeddings),
);

aiEngineRouter.delete(
  '/embeddings/:id',
  requirePermission('store:write'),
  validate({ params: embeddingParams }),
  asyncHandler(aiController.deleteEmbedding),
);

// ─── Context Management ─────────────────────────────────────────────
aiEngineRouter.post(
  '/contexts',
  requirePermission('store:write'),
  validate({ body: createContextSchema }),
  asyncHandler(aiController.createContext),
);

aiEngineRouter.get(
  '/contexts/:threadId',
  validate({ params: contextParams }),
  asyncHandler(aiController.getContext),
);

aiEngineRouter.put(
  '/contexts/:threadId',
  requirePermission('store:write'),
  validate({ params: contextParams, body: updateContextSchema }),
  asyncHandler(aiController.updateContext),
);

aiEngineRouter.delete(
  '/contexts/:threadId',
  requirePermission('store:write'),
  validate({ params: contextParams }),
  asyncHandler(aiController.deleteContext),
);

aiEngineRouter.get(
  '/contexts/:threadId/history',
  validate({ params: contextParams, query: contextHistoryQuery }),
  asyncHandler(aiController.getContextHistory),
);

// ─── Feedback ───────────────────────────────────────────────────────
aiEngineRouter.post(
  '/feedback',
  requirePermission('store:write'),
  validate({ body: createFeedbackSchema }),
  asyncHandler(aiController.createFeedback),
);

aiEngineRouter.get(
  '/feedback',
  validate({ query: listFeedbackQuery }),
  asyncHandler(aiController.listFeedback),
);

aiEngineRouter.get(
  '/feedback/analyze',
  asyncHandler(aiController.analyzeFeedback),
);

aiEngineRouter.get(
  '/responses/:id/feedback',
  validate({ params: feedbackResponseParams }),
  asyncHandler(aiController.getFeedbackByResponse),
);

// ─── Confidence Scoring ─────────────────────────────────────────────
aiEngineRouter.post(
  '/confidence/calculate',
  validate({ body: calculateConfidenceSchema }),
  asyncHandler(aiController.calculateConfidence),
);

aiEngineRouter.get(
  '/confidence/threshold',
  validate({ query: confidenceThresholdQuery }),
  asyncHandler(aiController.getConfidenceThreshold),
);

aiEngineRouter.put(
  '/confidence/threshold',
  requirePermission('store:write'),
  validate({ body: updateConfidenceThresholdSchema }),
  asyncHandler(aiController.updateConfidenceThreshold),
);

// ─── Intent Detection ───────────────────────────────────────────────
aiEngineRouter.post(
  '/intents/detect',
  validate({ body: detectIntentSchema }),
  asyncHandler(aiController.detectIntent),
);

aiEngineRouter.post(
  '/intents/train',
  requirePermission('store:write'),
  validate({ body: trainIntentSchema }),
  asyncHandler(aiController.trainIntentDetector),
);

aiEngineRouter.post(
  '/intents/evaluate',
  validate({ body: evaluateIntentSchema }),
  asyncHandler(aiController.evaluateIntentDetector),
);

aiEngineRouter.get(
  '/intents',
  validate({ query: listIntentsQuery }),
  asyncHandler(aiController.listIntents),
);

// ─── Entity Extraction ──────────────────────────────────────────────
aiEngineRouter.post(
  '/entities/extract',
  validate({ body: extractEntitiesSchema }),
  asyncHandler(aiController.extractEntities),
);

aiEngineRouter.post(
  '/entities/train',
  requirePermission('store:write'),
  validate({ body: trainEntitySchema }),
  asyncHandler(aiController.trainEntityExtractor),
);

aiEngineRouter.post(
  '/entities/evaluate',
  validate({ body: evaluateEntitySchema }),
  asyncHandler(aiController.evaluateEntityExtractor),
);

aiEngineRouter.get(
  '/entities/types',
  asyncHandler(aiController.listEntityTypes),
);

// ─── Response Generator ─────────────────────────────────────────────
aiEngineRouter.post(
  '/generate/auto-response',
  requirePermission('store:write'),
  validate({ body: generateAutoResponseSchema }),
  asyncHandler(aiController.generateAutoResponse),
);

aiEngineRouter.post(
  '/generate/product-description',
  requirePermission('store:write'),
  validate({ body: generateProductDescriptionSchema }),
  asyncHandler(aiController.generateProductDescription),
);

aiEngineRouter.post(
  '/generate/pricing-suggestion',
  requirePermission('store:write'),
  validate({ body: generatePricingSuggestionSchema }),
  asyncHandler(aiController.generatePricingSuggestion),
);

aiEngineRouter.post(
  '/generate/customer-segment',
  requirePermission('store:write'),
  validate({ body: generateCustomerSegmentSchema }),
  asyncHandler(aiController.generateCustomerSegment),
);

aiEngineRouter.post(
  '/generate/sales-forecast',
  requirePermission('store:write'),
  validate({ body: generateSalesForecastSchema }),
  asyncHandler(aiController.generateSalesForecast),
);

aiEngineRouter.post(
  '/generate/fraud-detection',
  requirePermission('store:write'),
  validate({ body: generateFraudDetectionSchema }),
  asyncHandler(aiController.generateFraudDetection),
);

aiEngineRouter.post(
  '/generate/delivery-time-prediction',
  requirePermission('store:write'),
  validate({ body: generateDeliveryPredictionSchema }),
  asyncHandler(aiController.generateDeliveryTimePrediction),
);

aiEngineRouter.post(
  '/generate/insights',
  requirePermission('store:write'),
  validate({ body: generateInsightsSchema }),
  asyncHandler(aiController.generateInsights),
);

aiEngineRouter.post(
  '/generate/report',
  requirePermission('store:write'),
  validate({ body: generateReportSchema }),
  asyncHandler(aiController.generateReport),
);
