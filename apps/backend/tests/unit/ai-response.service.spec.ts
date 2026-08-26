import { jest } from '@jest/globals';

jest.mock('../../src/modules/ai/services/claude-api.service.js', () => ({
  complete: jest.fn().mockResolvedValue({
    text: 'Hello! How can I help you today?',
    provider: 'anthropic',
    model: 'claude-3-haiku',
    tokensInput: 50,
    tokensOutput: 20,
    latencyMs: 500,
    cached: false,
  }),
  llmAvailable: jest.fn().mockReturnValue(true),
  getRateLimits: jest.fn().mockReturnValue({
    anthropic: { remaining: 60, resetAt: 0 },
    openai: { remaining: 60, resetAt: 0 },
  }),
}));

jest.mock('../../src/lib/redis.js', () => ({
  getRedis: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  }),
}));

jest.mock('../../src/modules/ai/services/ai-prompt.service.js', () => {
  return {
    aiPromptService: {
      getById: jest.fn().mockResolvedValue({
        id: 'p_1',
        systemPrompt: 'You are helpful',
        userTemplate: '{{message}}',
        name: 'test',
      }),
      render: jest.fn().mockImplementation((t, vars) =>
        t.replace(/\{\{\s*(\w+)\s*\}\}/g, (_: string, k: string) => vars[k] ?? ''),
      ),
      recordUsage: jest.fn().mockResolvedValue(undefined),
    },
  };
});

import { AIResponseService } from '../../src/modules/ai/services/ai-response.service.js';
import { complete } from '../../src/modules/ai/services/claude-api.service.js';

function createMockDb() {
  return {
    aIResponse: {
      create: jest.fn().mockResolvedValue({
        id: 'r_1', storeId: 'store_1', output: 'Hello!',
        tokensInput: 50, tokensOutput: 20, latencyMs: 500,
        confidence: 0.75, cached: false,
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('AIResponseService', () => {
  let service: AIResponseService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    service = new AIResponseService(mockDb as never);
  });

  describe('generate', () => {
    it('generates a response via LLM', async () => {
      const result = await service.generate('store_1', {
        userPrompt: 'Hello',
        useCache: false,
      });
      expect(result.output).toBe('Hello!');
      expect(complete).toHaveBeenCalled();
      expect(mockDb.aIResponse.create).toHaveBeenCalled();
    });

    it('uses prompt from ID when provided', async () => {
      await service.generate('store_1', {
        promptId: 'p_1',
        userPrompt: 'Hello',
        variables: { message: 'Hi there' },
        useCache: false,
      });
      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: 'You are helpful',
        }),
      );
    });

    it('returns cached response when available', async () => {
      const { getRedis } = await import('../../src/lib/redis.js');
      const redis = getRedis();
      (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify({
        id: 'cached_1', output: 'Cached reply', cached: true,
      }));

      const result = await service.generate('store_1', {
        userPrompt: 'Hello',
        useCache: true,
      });
      expect(result.cached).toBe(true);
      expect(result.output).toBe('Cached reply');
    });

    it('calculates confidence for the response', async () => {
      const result = await service.generate('store_1', {
        userPrompt: 'Hello',
        useCache: false,
      });
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(1);
    });
  });

  describe('list', () => {
    it('returns paginated responses', async () => {
      mockDb.aIResponse.findMany.mockResolvedValue([{ id: 'r_1' }]);
      const result = await service.list('store_1', 1, 20);
      expect(result).toHaveLength(1);
    });

    it('applies filters', async () => {
      await service.list('store_1', 1, 10, { promptId: 'p_1', cached: true });
      expect(mockDb.aIResponse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ promptId: 'p_1', cached: true }),
        }),
      );
    });
  });

  describe('count', () => {
    it('counts responses', async () => {
      mockDb.aIResponse.count.mockResolvedValue(42);
      const count = await service.count('store_1');
      expect(count).toBe(42);
    });
  });
});
