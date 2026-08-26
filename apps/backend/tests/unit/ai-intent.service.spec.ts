import { jest } from '@jest/globals';

jest.mock('../../src/modules/ai/services/claude-api.service.js', () => ({
  complete: jest.fn().mockResolvedValue({
    text: '{"intent":"PRICE_INQUIRY","confidence":0.95,"reasoning":"Customer asks about price"}',
    provider: 'anthropic',
    model: 'claude-3-haiku',
    tokensInput: 50,
    tokensOutput: 30,
    latencyMs: 800,
    cached: false,
  }),
}));

import { AIIntentService } from '../../src/modules/ai/services/ai-intent.service.js';
import { complete } from '../../src/modules/ai/services/claude-api.service.js';

function createMockDb() {
  return {
    aiIntent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
  };
}

describe('AIIntentService', () => {
  let service: AIIntentService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    service = new AIIntentService(mockDb as never);
  });

  describe('detectIntent', () => {
    it('detects intent via LLM', async () => {
      const result = await service.detectIntent('store_1', 'How much is this?');
      expect(result.intent).toBe('PRICE_INQUIRY');
      expect(result.confidence).toBe(0.95);
      expect(result.source).toBe('llm');
      expect(complete).toHaveBeenCalled();
    });

    it('falls back to custom intents when LLM unavailable', async () => {
      (complete as jest.Mock).mockRejectedValueOnce(new Error('No API key'));
      mockDb.aiIntent.findMany.mockResolvedValue([{
        name: 'BOOKING',
        keywords: ['book', 'reservation'],
        priority: 10,
      }]);

      const result = await service.detectIntent('store_1', 'I want to book a table');
      expect(result.intent).toBe('BOOKING');
      expect(result.source).toBe('custom');
    });

    it('returns UNKNOWN when no match and LLM unavailable', async () => {
      (complete as jest.Mock).mockRejectedValueOnce(new Error('No API key'));
      const result = await service.detectIntent('store_1', 'asdfghjkl');
      expect(result.intent).toBe('UNKNOWN');
      expect(result.source).toBe('heuristic');
    });

    it('falls back to heuristic on JSON parse failure', async () => {
      (complete as jest.Mock).mockResolvedValueOnce({
        text: 'This is not JSON',
        provider: 'anthropic',
        model: 'claude-3-haiku',
        tokensInput: 10,
        tokensOutput: 10,
        latencyMs: 100,
        cached: false,
      });
      const result = await service.detectIntent('store_1', 'hello');
      expect(result.source).toBe('heuristic');
    });
  });

  describe('trainIntentDetector', () => {
    it('creates new intents', async () => {
      mockDb.aiIntent.findFirst.mockResolvedValue(null);
      mockDb.aiIntent.create.mockResolvedValue({ id: 'i_1', name: 'BOOKING' });

      const result = await service.trainIntentDetector('store_1', [
        { name: 'BOOKING', examples: ['book', 'reserve', 'appointment'], keywords: ['book'] },
      ]);
      expect(result.processed).toBe(1);
      expect(mockDb.aiIntent.create).toHaveBeenCalled();
    });

    it('updates existing intents', async () => {
      mockDb.aiIntent.findFirst.mockResolvedValue({ id: 'i_1', name: 'BOOKING', keywords: ['old'] });
      mockDb.aiIntent.update.mockResolvedValue({ id: 'i_1', name: 'BOOKING' });

      const result = await service.trainIntentDetector('store_1', [
        { name: 'BOOKING', examples: ['book', 'reserve'], keywords: ['book', 'new'] },
      ]);
      expect(result.processed).toBe(1);
      expect(mockDb.aiIntent.update).toHaveBeenCalled();
    });
  });

  describe('evaluateIntentDetector', () => {
    it('calculates accuracy', async () => {
      const result = await service.evaluateIntentDetector('store_1', [
        { message: 'How much?', expectedIntent: 'PRICE_INQUIRY' },
        { message: 'Book a table', expectedIntent: 'BOOKING' },
      ]);
      expect(typeof result.accuracy).toBe('number');
      expect(result.total).toBe(2);
      expect(Array.isArray(result.details)).toBe(true);
    });
  });

  describe('listIntents', () => {
    it('returns paginated intents', async () => {
      mockDb.aiIntent.findMany.mockResolvedValue([{ id: 'i_1', name: 'TEST' }]);
      const result = await service.listIntents('store_1', 1, 20);
      expect(result).toHaveLength(1);
    });

    it('applies isActive filter', async () => {
      await service.listIntents('store_1', 1, 10, true);
      expect(mockDb.aiIntent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  describe('countIntents', () => {
    it('counts intents', async () => {
      mockDb.aiIntent.count.mockResolvedValue(5);
      const count = await service.countIntents('store_1');
      expect(count).toBe(5);
    });
  });
});
