import { jest } from '@jest/globals';

import { AIContextService } from '../../src/modules/ai/services/ai-context.service.js';

function createMockDb() {
  return {
    aIConversationContext: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
  };
}

describe('AIContextService', () => {
  let service: AIContextService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    service = new AIContextService(mockDb as never);
  });

  describe('createContext', () => {
    it('creates a new context', async () => {
      mockDb.aIConversationContext.findUnique.mockResolvedValue(null);
      mockDb.aIConversationContext.create.mockResolvedValue({
        id: 'ctx_1', threadId: 'thread_1', window: [], messageCount: 0,
      });

      const result = await service.createContext('store_1', 'thread_1', 'Hello');
      expect(result.id).toBe('ctx_1');
      expect(mockDb.aIConversationContext.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeId: 'store_1',
          threadId: 'thread_1',
        }),
      });
    });

    it('returns existing context if found', async () => {
      const existing = { id: 'ctx_1', threadId: 'thread_1', window: [] };
      mockDb.aIConversationContext.findUnique.mockResolvedValue(existing);

      const result = await service.createContext('store_1', 'thread_1');
      expect(result).toEqual(existing);
      expect(mockDb.aIConversationContext.create).not.toHaveBeenCalled();
    });
  });

  describe('getContext', () => {
    it('returns context when found', async () => {
      mockDb.aIConversationContext.findUnique.mockResolvedValue({
        id: 'ctx_1', threadId: 'thread_1',
      });
      const result = await service.getContext('store_1', 'thread_1');
      expect(result.id).toBe('ctx_1');
    });

    it('throws when not found', async () => {
      mockDb.aIConversationContext.findUnique.mockResolvedValue(null);
      await expect(service.getContext('store_1', 'missing')).rejects.toThrow();
    });
  });

  describe('updateContext', () => {
    it('adds a message to the window', async () => {
      const existing = {
        id: 'ctx_1', window: [{ role: 'user', content: 'Hi', timestamp: '2026-01-01' }],
        intentHistory: [], entities: {},
      };
      mockDb.aIConversationContext.findUnique.mockResolvedValue(existing);
      mockDb.aIConversationContext.update.mockResolvedValue({
        ...existing, window: [...existing.window, { role: 'assistant', content: 'Hello', timestamp: '2026-01-01' }],
      });

      const result = await service.updateContext('store_1', 'thread_1', 'Hello', 'assistant');
      expect(mockDb.aIConversationContext.update).toHaveBeenCalled();
    });

    it('creates context if not found', async () => {
      mockDb.aIConversationContext.findUnique.mockResolvedValue(null);
      mockDb.aIConversationContext.create.mockResolvedValue({
        id: 'ctx_1', window: [{ role: 'user', content: 'Hi', timestamp: '2026-01-01' }],
      });

      await service.updateContext('store_1', 'thread_1', 'Hi');
      expect(mockDb.aIConversationContext.create).toHaveBeenCalled();
    });
  });

  describe('deleteContext', () => {
    it('deletes an existing context', async () => {
      mockDb.aIConversationContext.findUnique.mockResolvedValue({ id: 'ctx_1' });
      await service.deleteContext('store_1', 'thread_1');
      expect(mockDb.aIConversationContext.delete).toHaveBeenCalledWith({ where: { id: 'ctx_1' } });
    });

    it('throws when not found', async () => {
      mockDb.aIConversationContext.findUnique.mockResolvedValue(null);
      await expect(service.deleteContext('store_1', 'missing')).rejects.toThrow();
    });
  });

  describe('getContextHistory', () => {
    it('returns message history', async () => {
      mockDb.aIConversationContext.findUnique.mockResolvedValue({
        window: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello' },
          { role: 'user', content: 'Price?' },
        ],
      });
      const history = await service.getContextHistory('store_1', 'thread_1', 2);
      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('Hello');
    });

    it('returns empty array when no context', async () => {
      mockDb.aIConversationContext.findUnique.mockResolvedValue(null);
      const history = await service.getContextHistory('store_1', 'thread_1');
      expect(history).toEqual([]);
    });
  });

  describe('updateMetadata', () => {
    it('updates sentiment', async () => {
      mockDb.aIConversationContext.findUnique.mockResolvedValue({
        id: 'ctx_1', intentHistory: [], entities: {},
      });
      await service.updateMetadata('store_1', 'thread_1', { sentiment: 'POSITIVE' });
      expect(mockDb.aIConversationContext.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sentiment: 'POSITIVE' }),
        }),
      );
    });

    it('appends to intent history', async () => {
      mockDb.aIConversationContext.findUnique.mockResolvedValue({
        id: 'ctx_1', intentHistory: ['GREETING'], entities: {},
      });
      await service.updateMetadata('store_1', 'thread_1', { intent: 'PRICE_INQUIRY' });
      expect(mockDb.aIConversationContext.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            intentHistory: ['GREETING', 'PRICE_INQUIRY'],
          }),
        }),
      );
    });

    it('merges entities', async () => {
      mockDb.aIConversationContext.findUnique.mockResolvedValue({
        id: 'ctx_1', intentHistory: [], entities: { color: 'red' },
      });
      await service.updateMetadata('store_1', 'thread_1', {
        entities: { size: 'XL' },
      });
      expect(mockDb.aIConversationContext.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entities: { color: 'red', size: 'XL' },
          }),
        }),
      );
    });
  });

  describe('cleanupExpired', () => {
    it('deletes expired contexts', async () => {
      const count = await service.cleanupExpired();
      expect(count).toBe(3);
    });
  });
});
