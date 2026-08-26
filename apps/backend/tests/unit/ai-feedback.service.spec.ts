import { jest } from '@jest/globals';

import { AIFeedbackService } from '../../src/modules/ai/services/ai-feedback.service.js';

function createMockDb() {
  return {
    aIFeedback: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _avg: { rating: null }, _count: { id: 0 } }),
      update: jest.fn(),
    },
    aIResponse: {
      findFirst: jest.fn().mockResolvedValue({ id: 'r_1', promptId: 'p_1' }),
    },
    aIPrompt: { update: jest.fn() },
    $executeRaw: jest.fn(),
  };
}

describe('AIFeedbackService', () => {
  let service: AIFeedbackService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    service = new AIFeedbackService(mockDb as never);
  });

  describe('createFeedback', () => {
    it('creates feedback for a response', async () => {
      mockDb.aIFeedback.create.mockResolvedValue({
        id: 'f_1', type: 'RATING', rating: 4,
      });

      const result = await service.createFeedback('store_1', {
        responseId: 'r_1',
        type: 'RATING',
        rating: 4,
        comment: 'Great response!',
      });
      expect(result.id).toBe('f_1');
      expect(mockDb.aIFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeId: 'store_1',
          responseId: 'r_1',
          type: 'RATING',
          rating: 4,
        }),
      });
    });

    it('throws when response not found', async () => {
      mockDb.aIResponse.findFirst.mockResolvedValue(null);
      await expect(service.createFeedback('store_1', {
        responseId: 'missing',
      })).rejects.toThrow();
    });
  });

  describe('getFeedbackByResponse', () => {
    it('returns feedback for a response', async () => {
      mockDb.aIFeedback.findMany.mockResolvedValue([{ id: 'f_1', responseId: 'r_1' }]);
      const result = await service.getFeedbackByResponse('store_1', 'r_1');
      expect(result).toHaveLength(1);
    });
  });

  describe('listFeedback', () => {
    it('returns paginated feedback', async () => {
      mockDb.aIFeedback.findMany.mockResolvedValue([{ id: 'f_1' }]);
      const result = await service.listFeedback('store_1', 1, 20);
      expect(result).toHaveLength(1);
    });

    it('applies type filter', async () => {
      await service.listFeedback('store_1', 1, 10, { type: 'CORRECTION' });
      expect(mockDb.aIFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'CORRECTION' }),
        }),
      );
    });
  });

  describe('analyzeFeedback', () => {
    it('returns analysis summary', async () => {
      mockDb.aIFeedback.count.mockResolvedValue(50);
      mockDb.aIFeedback.groupBy.mockResolvedValue([
        { type: 'RATING', _count: { id: 30 }, _avg: { rating: 4.2 } },
        { type: 'CORRECTION', _count: { id: 20 }, _avg: { rating: null } },
      ]);
      mockDb.aIFeedback.aggregate.mockResolvedValue({
        _avg: { rating: 4.2 },
        _count: { id: 30 },
      });
      mockDb.aIFeedback.findMany.mockResolvedValue([
        { correction: 'Wrong price', comment: 'Should be 5000', tags: ['price'], createdAt: new Date() },
      ]);

      const result = await service.analyzeFeedback('store_1');
      expect(result.totalFeedback).toBe(50);
      expect(Array.isArray(result.byType)).toBe(true);
      expect(result.averageRating).toBe(4.2);
    });
  });

  describe('markResolved', () => {
    it('marks feedback as resolved', async () => {
      mockDb.aIFeedback.findFirst.mockResolvedValue({ id: 'f_1', storeId: 'store_1' });
      mockDb.aIFeedback.update.mockResolvedValue({ id: 'f_1', resolved: true });

      const result = await service.markResolved('store_1', 'f_1');
      expect(result.resolved).toBe(true);
    });

    it('throws when not found', async () => {
      mockDb.aIFeedback.findFirst.mockResolvedValue(null);
      await expect(service.markResolved('store_1', 'missing')).rejects.toThrow();
    });
  });

  describe('countFeedback', () => {
    it('counts feedback', async () => {
      mockDb.aIFeedback.count.mockResolvedValue(25);
      const count = await service.countFeedback('store_1', { type: 'RATING' });
      expect(count).toBe(25);
    });
  });
});
