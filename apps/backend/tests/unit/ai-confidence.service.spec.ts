import { AIConfidenceService } from '../../src/modules/ai/services/ai-confidence.service.js';

function createMockDb() {
  return {
    aiConfiguration: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    aIConfidenceScore: {
      create: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
  };
}

describe('AIConfidenceService', () => {
  let service: AIConfidenceService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    service = new AIConfidenceService(mockDb as never);
  });

  describe('calculateConfidence', () => {
    it('returns base confidence for short responses', () => {
      const confidence = service.calculateConfidence('OK');
      expect(confidence).toBeGreaterThanOrEqual(0.05);
      expect(confidence).toBeLessThanOrEqual(0.99);
    });

    it('gives higher confidence to longer responses', () => {
      const short = service.calculateConfidence('Yes');
      const long = service.calculateConfidence(
        'The product costs ₦5,000 and is available in red, blue, and green. We offer free delivery within Lagos.',
      );
      expect(long).toBeGreaterThan(short);
    });

    it('penalizes hedging language', () => {
      const confident = service.calculateConfidence('The answer is definitely yes.');
      const hedged = service.calculateConfidence('I think maybe it might be possible.');
      expect(hedged).toBeLessThan(confident);
    });

    it('boosts confidence with context', () => {
      const withoutCtx = service.calculateConfidence('The price is ₦5,000');
      const withCtx = service.calculateConfidence('The price is ₦5,000', { product: 'shoes' });
      expect(withCtx).toBeGreaterThanOrEqual(withoutCtx);
    });

    it('boosts confidence for JSON responses', () => {
      const plain = service.calculateConfidence('The answer is 42.');
      const json = service.calculateConfidence('{"answer": 42, "confidence": 0.95}');
      expect(json).toBeGreaterThanOrEqual(plain);
    });

    it('clamps to 0.05-0.99 range', () => {
      const min = service.calculateConfidence('');
      const max = service.calculateConfidence(
        'I think maybe it might possibly be uncertain and unsure definitely certainly.',
      );
      expect(min).toBeGreaterThanOrEqual(0.05);
      expect(max).toBeLessThanOrEqual(0.99);
    });

    it('uses historical accuracy when provided', () => {
      const withHistory = service.calculateConfidence('Hello', {}, { accuracy: 0.95 });
      const withoutHistory = service.calculateConfidence('Hello');
      expect(withHistory).toBeGreaterThan(withoutHistory);
    });
  });

  describe('shouldEscalate', () => {
    it('escalates when below threshold', () => {
      expect(service.shouldEscalate(0.3, 0.6)).toBe(true);
    });

    it('does not escalate when above threshold', () => {
      expect(service.shouldEscalate(0.8, 0.6)).toBe(false);
    });

    it('does not escalate at exact threshold', () => {
      expect(service.shouldEscalate(0.6, 0.6)).toBe(false);
    });
  });

  describe('getThreshold', () => {
    it('returns store threshold for auto_response', async () => {
      mockDb.aiConfiguration.findUnique.mockResolvedValue({ confidenceThreshold: 0.75 });
      const threshold = await service.getThreshold('store_1', 'auto_response');
      expect(threshold).toBe(0.75);
    });

    it('returns default threshold when no config', async () => {
      mockDb.aiConfiguration.findUnique.mockResolvedValue(null);
      const threshold = await service.getThreshold('store_1', 'auto_response');
      expect(threshold).toBe(0.6);
    });

    it('returns default for non-auto_response use-cases', async () => {
      const threshold = await service.getThreshold('store_1', 'fraud_detection');
      expect(threshold).toBe(0.75);
    });
  });

  describe('logScore', () => {
    it('creates a confidence score record', async () => {
      mockDb.aIConfidenceScore.create.mockResolvedValue({ id: 'score_1' });
      const result = await service.logScore('store_1', {
        useCase: 'auto_response',
        confidence: 0.85,
        threshold: 0.6,
        escalated: false,
        responseId: 'resp_1',
        context: { message: 'Hello' },
      });
      expect(result.id).toBe('score_1');
      expect(mockDb.aIConfidenceScore.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeId: 'store_1',
          useCase: 'auto_response',
          confidence: 0.85,
          threshold: 0.6,
          escalated: false,
        }),
      });
    });
  });

  describe('getStats', () => {
    it('returns aggregated stats', async () => {
      mockDb.aIConfidenceScore.aggregate.mockResolvedValue({
        _avg: { confidence: 0.78 },
        _min: { confidence: 0.3 },
        _max: { confidence: 0.99 },
        _count: { id: 100 },
      });
      mockDb.aIConfidenceScore.count.mockResolvedValue(15);
      mockDb.aiConfiguration.findUnique.mockResolvedValue(null);

      const stats = await service.getStats('store_1', 'auto_response', 30);
      expect(stats.totalResponses).toBe(100);
      expect(stats.escalationCount).toBe(15);
      expect(stats.escalationRate).toBe(15);
      expect(stats.avgConfidence).toBe(0.78);
    });
  });

  describe('listThresholds', () => {
    it('returns all thresholds with defaults', async () => {
      mockDb.aiConfiguration.findUnique.mockResolvedValue(null);
      const thresholds = await service.listThresholds('store_1');
      expect(Array.isArray(thresholds)).toBe(true);
      expect(thresholds.length).toBeGreaterThan(0);
      expect(thresholds.find((t: Record<string, unknown>) => t.useCase === 'auto_response')).toBeDefined();
      expect(thresholds.find((t: Record<string, unknown>) => t.useCase === 'fraud_detection')).toBeDefined();
    });

    it('uses store config for auto_response threshold', async () => {
      mockDb.aiConfiguration.findUnique.mockResolvedValue({ confidenceThreshold: 0.85 });
      const thresholds = await service.listThresholds('store_1');
      const autoResponse = thresholds.find((t: Record<string, unknown>) => t.useCase === 'auto_response');
      expect(autoResponse?.threshold).toBe(0.85);
      expect(autoResponse?.isCustom).toBe(true);
    });
  });
});
