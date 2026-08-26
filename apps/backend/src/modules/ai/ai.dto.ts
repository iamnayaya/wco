import { z } from 'zod';

// ─── Shared Fragments ────────────────────────────────────────────────

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

const dateRange = {
  dateFrom: z.coerce.string().datetime().optional(),
  dateTo: z.coerce.string().datetime().optional(),
};

// ─── AI Model DTOs ───────────────────────────────────────────────────

export const createAIModelSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'cohere']),
  modelId: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  maxTokens: z.number().int().min(1).max(128000).default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  costPerInput: z.number().min(0).optional(),
  costPerOutput: z.number().min(0).optional(),
  rateLimitRpm: z.number().int().min(1).max(10000).default(60),
  isPrimary: z.boolean().default(false),
  priority: z.number().int().default(0),
});
export type CreateAIModelDto = z.infer<typeof createAIModelSchema>;

export const updateAIModelSchema = createAIModelSchema.partial();
export type UpdateAIModelDto = z.infer<typeof updateAIModelSchema>;

export const aiModelParams = z.object({ id: z.string().min(1).max(64) });
export type AIModelParams = z.infer<typeof aiModelParams>;

// ─── AI Prompt DTOs ──────────────────────────────────────────────────

export const createAIPromptSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum([
    'GREETING', 'PRICE_INQUIRY', 'ORDER_CONFIRMATION', 'SHIPPING_INFO',
    'PAYMENT_REMINDER', 'ABANDONED_CART', 'OUT_OF_STOCK', 'REVIEW_REQUEST',
    'ESCALATION', 'CUSTOM',
  ]).default('CUSTOM'),
  systemPrompt: z.string().min(1).max(10000),
  userTemplate: z.string().min(1).max(10000),
  variables: z.array(z.string().max(100)).default([]),
  language: z.string().min(2).max(10).default('en'),
  modelId: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
});
export type CreateAIPromptDto = z.infer<typeof createAIPromptSchema>;

export const updateAIPromptSchema = createAIPromptSchema.partial();
export type UpdateAIPromptDto = z.infer<typeof updateAIPromptSchema>;

export const promptParams = z.object({ id: z.string().min(1).max(64) });
export type PromptParams = z.infer<typeof promptParams>;

export const promptNameParams = z.object({ name: z.string().min(1).max(200) });
export type PromptNameParams = z.infer<typeof promptNameParams>;

export const renderPromptSchema = z.object({
  variables: z.record(z.string()),
});
export type RenderPromptDto = z.infer<typeof renderPromptSchema>;

export const optimizePromptSchema = z.object({
  feedback: z.string().min(1).max(5000),
});
export type OptimizePromptDto = z.infer<typeof optimizePromptSchema>;

export const listPromptsQuery = z.object({
  ...pagination,
  category: z.enum([
    'GREETING', 'PRICE_INQUIRY', 'ORDER_CONFIRMATION', 'SHIPPING_INFO',
    'PAYMENT_REMINDER', 'ABANDONED_CART', 'OUT_OF_STOCK', 'REVIEW_REQUEST',
    'ESCALATION', 'CUSTOM',
  ]).optional(),
  language: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});
export type ListPromptsQuery = z.infer<typeof listPromptsQuery>;

// ─── AI Response DTOs ────────────────────────────────────────────────

export const generateResponseSchema = z.object({
  promptId: z.string().optional(),
  systemPrompt: z.string().optional(),
  userPrompt: z.string().min(1).max(10000),
  modelId: z.string().optional(),
  threadId: z.string().optional(),
  variables: z.record(z.string()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  useCache: z.boolean().default(true),
  context: z.record(z.unknown()).optional(),
});
export type GenerateResponseDto = z.infer<typeof generateResponseSchema>;

export const listResponsesQuery = z.object({
  ...pagination,
  ...dateRange,
  promptId: z.string().optional(),
  modelId: z.string().optional(),
  cached: z.coerce.boolean().optional(),
  escalated: z.coerce.boolean().optional(),
});
export type ListResponsesQuery = z.infer<typeof listResponsesQuery>;

export const cacheKeyQuery = z.object({
  key: z.string().min(1).max(256),
});
export type CacheKeyQuery = z.infer<typeof cacheKeyQuery>;

// ─── AI Embedding DTOs ───────────────────────────────────────────────

export const generateEmbeddingSchema = z.object({
  entityType: z.enum(['product', 'customer', 'message', 'document']),
  entityId: z.string().min(1).max(64),
  text: z.string().min(1).max(10000),
  metadata: z.record(z.unknown()).default({}),
});
export type GenerateEmbeddingDto = z.infer<typeof generateEmbeddingSchema>;

export const searchEmbeddingsSchema = z.object({
  query: z.string().min(1).max(5000),
  entityType: z.enum(['product', 'customer', 'message', 'document']).optional(),
  limit: z.number().int().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
});
export type SearchEmbeddingsDto = z.infer<typeof searchEmbeddingsSchema>;

export const embeddingParams = z.object({ id: z.string().min(1).max(64) });
export type EmbeddingParams = z.infer<typeof embeddingParams>;

// ─── AI Context DTOs ─────────────────────────────────────────────────

export const createContextSchema = z.object({
  threadId: z.string().min(1).max(64),
  initialMessage: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type CreateContextDto = z.infer<typeof createContextSchema>;

export const updateContextSchema = z.object({
  message: z.string().min(1).max(5000),
  role: z.enum(['user', 'assistant', 'system']).default('user'),
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateContextDto = z.infer<typeof updateContextSchema>;

export const contextParams = z.object({ threadId: z.string().min(1).max(64) });
export type ContextParams = z.infer<typeof contextParams>;

export const contextHistoryQuery = z.object({
  ...pagination,
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ContextHistoryQuery = z.infer<typeof contextHistoryQuery>;

// ─── AI Feedback DTOs ────────────────────────────────────────────────

export const createFeedbackSchema = z.object({
  responseId: z.string().min(1).max(64),
  type: z.enum(['RATING', 'CORRECTION', 'THUMBS_UP', 'THUMBS_DOWN', 'TAG']).default('RATING'),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(5000).optional(),
  correction: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).default([]),
});
export type CreateFeedbackDto = z.infer<typeof createFeedbackSchema>;

export const listFeedbackQuery = z.object({
  ...pagination,
  ...dateRange,
  type: z.enum(['RATING', 'CORRECTION', 'THUMBS_UP', 'THUMBS_DOWN', 'TAG']).optional(),
  resolved: z.coerce.boolean().optional(),
});
export type ListFeedbackQuery = z.infer<typeof listFeedbackQuery>;

export const feedbackResponseParams = z.object({ id: z.string().min(1).max(64) });
export type FeedbackResponseParams = z.infer<typeof feedbackResponseParams>;

// ─── AI Confidence DTOs ──────────────────────────────────────────────

export const calculateConfidenceSchema = z.object({
  responseId: z.string().optional(),
  response: z.string().min(1).max(10000),
  context: z.record(z.unknown()).optional(),
  useCase: z.string().min(1).max(100).default('auto_response'),
});
export type CalculateConfidenceDto = z.infer<typeof calculateConfidenceSchema>;

export const confidenceThresholdQuery = z.object({
  useCase: z.string().min(1).max(100).default('auto_response'),
});
export type ConfidenceThresholdQuery = z.infer<typeof confidenceThresholdQuery>;

export const updateConfidenceThresholdSchema = z.object({
  useCase: z.string().min(1).max(100),
  threshold: z.number().min(0).max(1),
});
export type UpdateConfidenceThresholdDto = z.infer<typeof updateConfidenceThresholdSchema>;

// ─── AI Intent DTOs ──────────────────────────────────────────────────

export const detectIntentSchema = z.object({
  message: z.string().min(1).max(5000),
  context: z.record(z.unknown()).optional(),
  language: z.string().optional(),
});
export type DetectIntentDto = z.infer<typeof detectIntentSchema>;

export const trainIntentSchema = z.object({
  intents: z.array(z.object({
    name: z.string().min(1).max(100),
    examples: z.array(z.string().min(1).max(500)).min(3).max(50),
    keywords: z.array(z.string().max(100)).optional(),
  })).min(1).max(50),
});
export type TrainIntentDto = z.infer<typeof trainIntentSchema>;

export const evaluateIntentSchema = z.object({
  testCases: z.array(z.object({
    message: z.string().min(1).max(5000),
    expectedIntent: z.string().min(1).max(100),
  })).min(1).max(100),
});
export type EvaluateIntentDto = z.infer<typeof evaluateIntentSchema>;

export const listIntentsQuery = z.object({
  ...pagination,
  isActive: z.coerce.boolean().optional(),
});
export type ListIntentsQuery = z.infer<typeof listIntentsQuery>;

// ─── AI Entity DTOs ──────────────────────────────────────────────────

export const extractEntitiesSchema = z.object({
  message: z.string().min(1).max(5000),
  intent: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});
export type ExtractEntitiesDto = z.infer<typeof extractEntitiesSchema>;

export const trainEntitySchema = z.object({
  entityType: z.string().min(1).max(100),
  examples: z.array(z.object({
    text: z.string().min(1).max(5000),
    entities: z.record(z.string()),
  })).min(3).max(50),
});
export type TrainEntityDto = z.infer<typeof trainEntitySchema>;

export const evaluateEntitySchema = z.object({
  entityType: z.string().min(1).max(100),
  testCases: z.array(z.object({
    text: z.string().min(1).max(5000),
    expectedEntities: z.record(z.string()),
  })).min(1).max(100),
});
export type EvaluateEntityDto = z.infer<typeof evaluateEntitySchema>;

export const listEntityTypesQuery = z.object({
  ...pagination,
});
export type ListEntityTypesQuery = z.infer<typeof listEntityTypesQuery>;

// ─── AI Response Generator DTOs ──────────────────────────────────────

export const generateAutoResponseSchema = z.object({
  message: z.string().min(1).max(5000),
  threadId: z.string().optional(),
  tone: z.enum(['FRIENDLY', 'PROFESSIONAL', 'PLAYFUL', 'CONCISE']).optional(),
  language: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});
export type GenerateAutoResponseDto = z.infer<typeof generateAutoResponseSchema>;

export const generateProductDescriptionSchema = z.object({
  productName: z.string().min(1).max(200),
  category: z.string().optional(),
  price: z.number().min(0).optional(),
  features: z.array(z.string().max(200)).default([]),
  targetAudience: z.string().max(200).optional(),
  language: z.string().default('en'),
  tone: z.enum(['FRIENDLY', 'PROFESSIONAL', 'PLAYFUL', 'CONCISE']).default('FRIENDLY'),
});
export type GenerateProductDescriptionDto = z.infer<typeof generateProductDescriptionSchema>;

export const generatePricingSuggestionSchema = z.object({
  productName: z.string().min(1).max(200),
  currentPrice: z.number().min(0),
  costPrice: z.number().min(0),
  category: z.string().optional(),
  competitorPrices: z.array(z.number().min(0)).default([]),
  demand: z.enum(['low', 'medium', 'high']).default('medium'),
  position: z.enum(['budget', 'mid', 'premium']).default('mid'),
});
export type GeneratePricingSuggestionDto = z.infer<typeof generatePricingSuggestionSchema>;

export const generateCustomerSegmentSchema = z.object({
  customerName: z.string().min(1).max(200),
  totalOrders: z.number().int().min(0),
  totalSpent: z.number().min(0),
  lastOrderDate: z.coerce.string().datetime(),
  avgOrderValue: z.number().min(0),
  preferredCategory: z.string().optional(),
});
export type GenerateCustomerSegmentDto = z.infer<typeof generateCustomerSegmentSchema>;

export const generateSalesForecastSchema = z.object({
  period: z.string().min(1).max(100),
  lookbackDays: z.number().int().min(7).max(365).default(30),
  topProducts: z.array(z.string()).default([]),
  season: z.string().optional(),
  externalFactors: z.array(z.string()).default([]),
});
export type GenerateSalesForecastDto = z.infer<typeof generateSalesForecastSchema>;

export const generateFraudDetectionSchema = z.object({
  orderId: z.string().min(1).max(64),
  amount: z.number().min(0),
  paymentMethod: z.string().min(1).max(100),
  customerName: z.string().optional(),
  shippingAddress: z.string().optional(),
  orderHistory: z.string().optional(),
  paymentVelocity: z.string().optional(),
});
export type GenerateFraudDetectionDto = z.infer<typeof generateFraudDetectionSchema>;

export const generateDeliveryPredictionSchema = z.object({
  pickupAddress: z.string().min(1).max(500),
  dropoffAddress: z.string().min(1).max(500),
  carrier: z.string().optional(),
  timeOfDay: z.string().optional(),
  dayOfWeek: z.string().optional(),
  conditions: z.string().optional(),
});
export type GenerateDeliveryPredictionDto = z.infer<typeof generateDeliveryPredictionSchema>;

export const generateInsightsSchema = z.object({
  period: z.string().min(1).max(100),
  metrics: z.record(z.unknown()).default({}),
  storeName: z.string().optional(),
});
export type GenerateInsightsDto = z.infer<typeof generateInsightsSchema>;

export const generateReportSchema = z.object({
  reportType: z.string().min(1).max(100),
  period: z.string().min(1).max(100),
  dataSummary: z.string().min(1).max(10000),
  keyMetrics: z.record(z.unknown()).default({}),
  comparisonPeriod: z.string().optional(),
});
export type GenerateReportDto = z.infer<typeof generateReportSchema>;
