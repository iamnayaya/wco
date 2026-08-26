import { z } from 'zod';
import {
  createAIModelSchema,
  createAIPromptSchema,
  updateAIPromptSchema,
  generateResponseSchema,
  generateEmbeddingSchema,
  searchEmbeddingsSchema,
  createContextSchema,
  updateContextSchema,
  createFeedbackSchema,
  calculateConfidenceSchema,
  updateConfidenceThresholdSchema,
  detectIntentSchema,
  trainIntentSchema,
  evaluateIntentSchema,
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
  listPromptsQuery,
  listResponsesQuery,
  listFeedbackQuery,
  listIntentsQuery,
  contextHistoryQuery,
  confidenceThresholdQuery,
} from '../../src/modules/ai/ai.dto.js';

function expectValid<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  expect(result.success).toBe(true);
  return result.success ? result.data : (undefined as never);
}

function expectInvalid(schema: z.ZodType, data: unknown): void {
  expect(schema.safeParse(data).success).toBe(false);
}

describe('AI DTOs', () => {
  describe('createAIModelSchema', () => {
    it('validates a valid model creation', () => {
      const data = expectValid(createAIModelSchema, {
        provider: 'anthropic',
        modelId: 'claude-3-haiku-20240307',
        displayName: 'Claude 3 Haiku',
        apiKey: 'sk-ant-xxx',
      });
      expect(data.maxTokens).toBe(4096);
      expect(data.temperature).toBe(0.7);
      expect(data.isPrimary).toBe(false);
    });

    it('rejects missing provider', () => {
      expectInvalid(createAIModelSchema, { modelId: 'x', displayName: 'x' });
    });

    it('rejects invalid provider', () => {
      expectInvalid(createAIModelSchema, { provider: 'invalid', modelId: 'x', displayName: 'x' });
    });
  });

  describe('createAIPromptSchema', () => {
    it('validates a valid prompt', () => {
      const data = expectValid(createAIPromptSchema, {
        name: 'my-prompt',
        systemPrompt: 'You are helpful.',
        userTemplate: 'Answer: {{question}}',
      });
      expect(data.category).toBe('CUSTOM');
      expect(data.language).toBe('en');
    });

    it('rejects empty name', () => {
      expectInvalid(createAIPromptSchema, {
        name: '',
        systemPrompt: 'test',
        userTemplate: 'test',
      });
    });

    it('rejects empty systemPrompt', () => {
      expectInvalid(createAIPromptSchema, {
        name: 'test',
        systemPrompt: '',
        userTemplate: 'test',
      });
    });
  });

  describe('generateResponseSchema', () => {
    it('validates a minimal request', () => {
      const data = expectValid(generateResponseSchema, {
        userPrompt: 'Hello',
      });
      expect(data.useCache).toBe(true);
    });

    it('rejects empty userPrompt', () => {
      expectInvalid(generateResponseSchema, { userPrompt: '' });
    });
  });

  describe('generateEmbeddingSchema', () => {
    it('validates a valid embedding request', () => {
      const data = expectValid(generateEmbeddingSchema, {
        entityType: 'product',
        entityId: 'prod_1',
        text: 'Nike shoes',
      });
      expect(data.metadata).toEqual({});
    });

    it('rejects invalid entityType', () => {
      expectInvalid(generateEmbeddingSchema, {
        entityType: 'invalid',
        entityId: 'x',
        text: 'x',
      });
    });
  });

  describe('searchEmbeddingsSchema', () => {
    it('validates a search query', () => {
      const data = expectValid(searchEmbeddingsSchema, {
        query: 'red shoes',
      });
      expect(data.limit).toBe(10);
      expect(data.threshold).toBe(0.7);
    });
  });

  describe('createContextSchema', () => {
    it('validates context creation', () => {
      const data = expectValid(createContextSchema, {
        threadId: 'thread_1',
      });
      expect(data.metadata).toEqual({});
    });
  });

  describe('updateContextSchema', () => {
    it('validates context update', () => {
      const data = expectValid(updateContextSchema, {
        message: 'Hello',
      });
      expect(data.role).toBe('user');
    });

    it('rejects empty message', () => {
      expectInvalid(updateContextSchema, { message: '' });
    });
  });

  describe('createFeedbackSchema', () => {
    it('validates feedback creation', () => {
      const data = expectValid(createFeedbackSchema, {
        responseId: 'resp_1',
        type: 'RATING',
        rating: 4,
      });
      expect(data.tags).toEqual([]);
    });

    it('rejects invalid rating', () => {
      expectInvalid(createFeedbackSchema, {
        responseId: 'resp_1',
        rating: 6,
      });
    });
  });

  describe('calculateConfidenceSchema', () => {
    it('validates confidence calculation', () => {
      const data = expectValid(calculateConfidenceSchema, {
        response: 'The answer is 42.',
      });
      expect(data.useCase).toBe('auto_response');
    });
  });

  describe('updateConfidenceThresholdSchema', () => {
    it('validates threshold update', () => {
      const data = expectValid(updateConfidenceThresholdSchema, {
        useCase: 'auto_response',
        threshold: 0.8,
      });
      expect(data.threshold).toBe(0.8);
    });

    it('rejects threshold > 1', () => {
      expectInvalid(updateConfidenceThresholdSchema, {
        useCase: 'test',
        threshold: 1.5,
      });
    });
  });

  describe('detectIntentSchema', () => {
    it('validates intent detection', () => {
      const data = expectValid(detectIntentSchema, {
        message: 'How much is this?',
      });
      expect(data.context).toBeUndefined();
    });
  });

  describe('trainIntentSchema', () => {
    it('validates training data', () => {
      const data = expectValid(trainIntentSchema, {
        intents: [{
          name: 'GREETING',
          examples: ['hello', 'hi', 'hey there', 'good morning'],
        }],
      });
      expect(data.intents[0].keywords).toBeUndefined();
    });

    it('rejects less than 3 examples', () => {
      expectInvalid(trainIntentSchema, {
        intents: [{ name: 'X', examples: ['a', 'b'] }],
      });
    });
  });

  describe('evaluateIntentSchema', () => {
    it('validates test cases', () => {
      expectValid(evaluateIntentSchema, {
        testCases: [{ message: 'hello', expectedIntent: 'GREETING' }],
      });
    });

    it('rejects empty test cases', () => {
      expectInvalid(evaluateIntentSchema, { testCases: [] });
    });
  });

  describe('extractEntitiesSchema', () => {
    it('validates entity extraction', () => {
      expectValid(extractEntitiesSchema, {
        message: 'I want 2 red shoes size 42',
      });
    });
  });

  describe('trainEntitySchema', () => {
    it('validates entity training', () => {
      expectValid(trainEntitySchema, {
        entityType: 'color',
        examples: [
          { text: 'I want red shoes', entities: { color: 'red' } },
          { text: 'Blue dress please', entities: { color: 'blue' } },
          { text: 'Green shirt', entities: { color: 'green' } },
        ],
      });
    });
  });

  describe('generateAutoResponseSchema', () => {
    it('validates auto-response generation', () => {
      const data = expectValid(generateAutoResponseSchema, {
        message: 'How much is the dress?',
      });
      expect(data.tone).toBeUndefined();
    });
  });

  describe('generateProductDescriptionSchema', () => {
    it('validates product description', () => {
      const data = expectValid(generateProductDescriptionSchema, {
        productName: 'Nike Air Max',
        price: 45000,
        features: ['lightweight', 'durable'],
      });
      expect(data.language).toBe('en');
      expect(data.features).toHaveLength(2);
    });
  });

  describe('generatePricingSuggestionSchema', () => {
    it('validates pricing suggestion', () => {
      expectValid(generatePricingSuggestionSchema, {
        productName: 'Shoes',
        currentPrice: 5000,
        costPrice: 3000,
        competitorPrices: [4500, 5500],
      });
    });
  });

  describe('generateCustomerSegmentSchema', () => {
    it('validates customer segment', () => {
      expectValid(generateCustomerSegmentSchema, {
        customerName: 'John',
        totalOrders: 10,
        totalSpent: 50000,
        lastOrderDate: '2026-01-15T12:00:00Z',
        avgOrderValue: 5000,
      });
    });
  });

  describe('generateSalesForecastSchema', () => {
    it('validates sales forecast', () => {
      const data = expectValid(generateSalesForecastSchema, {
        period: 'next 30 days',
      });
      expect(data.lookbackDays).toBe(30);
    });
  });

  describe('generateFraudDetectionSchema', () => {
    it('validates fraud detection', () => {
      expectValid(generateFraudDetectionSchema, {
        orderId: 'ord_1',
        amount: 50000,
        paymentMethod: 'card',
      });
    });
  });

  describe('generateDeliveryPredictionSchema', () => {
    it('validates delivery prediction', () => {
      expectValid(generateDeliveryPredictionSchema, {
        pickupAddress: 'Lagos Island',
        dropoffAddress: 'Victoria Island',
      });
    });
  });

  describe('generateInsightsSchema', () => {
    it('validates insights generation', () => {
      expectValid(generateInsightsSchema, {
        period: 'last 30 days',
        metrics: { revenue: 100000 },
      });
    });
  });

  describe('generateReportSchema', () => {
    it('validates report generation', () => {
      expectValid(generateReportSchema, {
        reportType: 'SALES',
        period: 'January 2026',
        dataSummary: 'Revenue was 500k',
      });
    });
  });

  describe('Query schemas', () => {
    it('listPromptsQuery defaults', () => {
      const data = expectValid(listPromptsQuery, {});
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(20);
    });

    it('listResponsesQuery defaults', () => {
      const data = expectValid(listResponsesQuery, {});
      expect(data.page).toBe(1);
    });

    it('listFeedbackQuery defaults', () => {
      const data = expectValid(listFeedbackQuery, {});
      expect(data.page).toBe(1);
    });

    it('listIntentsQuery defaults', () => {
      const data = expectValid(listIntentsQuery, {});
      expect(data.page).toBe(1);
    });

    it('contextHistoryQuery defaults', () => {
      const data = expectValid(contextHistoryQuery, {});
      expect(data.limit).toBe(20);
    });

    it('confidenceThresholdQuery defaults', () => {
      const data = expectValid(confidenceThresholdQuery, {});
      expect(data.useCase).toBe('auto_response');
    });
  });
});
