import { jest } from '@jest/globals';

jest.mock('../../src/modules/ai/services/prompt-templates.js', () => {
  const actual = jest.requireActual('../../src/modules/ai/services/prompt-templates.js');
  return {
    ...actual,
    PROMPT_TEMPLATES: [
      {
        name: 'auto-responder',
        category: 'CUSTOM',
        systemPrompt: 'You are {{storeName}} assistant. Tone: {{tone}}. Reply in {{language}}.{{businessContext}}{{catalogContext}}',
        userTemplate: 'Customer says: "{{message}}". Draft one helpful reply.',
        variables: ['storeName', 'tone', 'language', 'businessContext', 'catalogContext', 'message'],
        language: 'en',
        temperature: 0.7,
        maxTokens: 256,
      },
    ],
    getTemplateByName: (name: string) => {
      const templates = [{
        name: 'auto-responder',
        category: 'CUSTOM',
        systemPrompt: 'You are {{storeName}} assistant. Tone: {{tone}}.',
        userTemplate: 'Customer says: "{{message}}".',
        variables: ['storeName', 'tone', 'message'],
        language: 'en',
        temperature: 0.7,
        maxTokens: 256,
      }];
      return templates.find((t) => t.name === name);
    },
    renderTemplate: (template: string, variables: Record<string, string>) =>
      template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => variables[key] ?? match),
  };
});

import { AIPromptService } from '../../src/modules/ai/services/ai-prompt.service.js';

function createMockDb() {
  return {
    aIPrompt: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };
}

describe('AIPromptService', () => {
  let service: AIPromptService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = createMockDb();
    service = new AIPromptService(mockDb as never);
  });

  describe('create', () => {
    it('creates a new prompt', async () => {
      mockDb.aIPrompt.findFirst.mockResolvedValue(null);
      mockDb.aIPrompt.create.mockResolvedValue({
        id: 'p_1', name: 'test', version: 1, systemPrompt: 'sys', userTemplate: 'usr',
      });

      const result = await service.create('store_1', {
        name: 'test',
        systemPrompt: 'You are {{role}}',
        userTemplate: 'Hello {{name}}',
      });
      expect(result.id).toBe('p_1');
      expect(mockDb.aIPrompt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storeId: 'store_1',
          name: 'test',
          version: 1,
          variables: expect.arrayContaining(['role', 'name']),
        }),
      });
    });

    it('increments version when same name exists', async () => {
      mockDb.aIPrompt.findFirst.mockResolvedValue({ name: 'test', version: 2 });
      mockDb.aIPrompt.create.mockResolvedValue({
        id: 'p_2', name: 'test', version: 3,
      });

      await service.create('store_1', {
        name: 'test',
        systemPrompt: 'sys',
        userTemplate: 'usr',
      });
      expect(mockDb.aIPrompt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ version: 3 }),
      });
    });

    it('auto-extracts variables from templates', async () => {
      mockDb.aIPrompt.findFirst.mockResolvedValue(null);
      mockDb.aIPrompt.create.mockResolvedValue({ id: 'p_3' });

      await service.create('store_1', {
        name: 'test',
        systemPrompt: 'You are {{storeName}}',
        userTemplate: 'Price is {{price}}',
      });
      expect(mockDb.aIPrompt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          variables: expect.arrayContaining(['storeName', 'price']),
        }),
      });
    });
  });

  describe('getById', () => {
    it('returns prompt when found', async () => {
      mockDb.aIPrompt.findFirst.mockResolvedValue({ id: 'p_1', storeId: 'store_1' });
      const result = await service.getById('store_1', 'p_1');
      expect(result.id).toBe('p_1');
    });

    it('throws when not found', async () => {
      mockDb.aIPrompt.findFirst.mockResolvedValue(null);
      await expect(service.getById('store_1', 'missing')).rejects.toThrow();
    });
  });

  describe('getByName', () => {
    it('returns latest version of named prompt', async () => {
      mockDb.aIPrompt.findFirst.mockResolvedValue({
        id: 'p_2', name: 'test', version: 3,
      });
      const result = await service.getByName('store_1', 'test');
      expect(result.version).toBe(3);
    });

    it('throws when not found', async () => {
      mockDb.aIPrompt.findFirst.mockResolvedValue(null);
      await expect(service.getByName('store_1', 'missing')).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('returns paginated prompts', async () => {
      mockDb.aIPrompt.findMany.mockResolvedValue([{ id: 'p_1' }]);
      const result = await service.list('store_1', 1, 20);
      expect(result).toHaveLength(1);
    });

    it('applies filters', async () => {
      mockDb.aIPrompt.findMany.mockResolvedValue([]);
      await service.list('store_1', 1, 10, { category: 'GREETING', language: 'en' });
      expect(mockDb.aIPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'GREETING', language: 'en' }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('soft-deletes a prompt', async () => {
      mockDb.aIPrompt.findFirst.mockResolvedValue({ id: 'p_1', storeId: 'store_1' });
      mockDb.aIPrompt.update.mockResolvedValue({ id: 'p_1', isActive: false });
      await service.delete('store_1', 'p_1');
      expect(mockDb.aIPrompt.update).toHaveBeenCalledWith({
        where: { id: 'p_1' },
        data: { isActive: false },
      });
    });
  });

  describe('render', () => {
    it('renders template with variables', () => {
      const result = service.render('Hello {{name}}, welcome to {{store}}!', {
        name: 'John',
        store: 'WCO',
      });
      expect(result).toBe('Hello John, welcome to WCO!');
    });
  });

  describe('getBuiltInTemplates', () => {
    it('returns template list', () => {
      const templates = service.getBuiltInTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('getBuiltInTemplate', () => {
    it('returns template by name', () => {
      const template = service.getBuiltInTemplate('auto-responder');
      expect(template).toBeDefined();
      expect(template!.name).toBe('auto-responder');
    });

    it('returns undefined for unknown name', () => {
      const template = service.getBuiltInTemplate('nonexistent');
      expect(template).toBeUndefined();
    });
  });
});
