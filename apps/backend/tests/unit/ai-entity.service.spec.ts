import { AIEntityService } from '../../src/modules/ai/services/ai-entity.service.js';

describe('AIEntityService', () => {
  let service: AIEntityService;

  beforeEach(() => {
    service = new AIEntityService();
  });

  describe('listEntityTypes', () => {
    it('returns all supported entity types', () => {
      const types = service.listEntityTypes();
      expect(types.length).toBeGreaterThanOrEqual(8);
      expect(types.map((t) => t.type)).toContain('quantity');
      expect(types.map((t) => t.type)).toContain('color');
      expect(types.map((t) => t.type)).toContain('size');
      expect(types.map((t) => t.type)).toContain('amount');
      expect(types.map((t) => t.type)).toContain('phone');
    });
  });

  describe('extractEntities (heuristic fallback)', () => {
    it('extracts quantities from text', async () => {
      const result = await service.extractEntities('I want 3 red shoes');
      expect(result.quantities).toContain(3);
      expect(result.colors).toContain('red');
      expect(result.source).toBeDefined();
    });

    it('extracts multiple colors', async () => {
      const result = await service.extractEntities('Do you have blue and green dresses?');
      expect(result.colors).toContain('blue');
      expect(result.colors).toContain('green');
    });

    it('extracts sizes', async () => {
      const result = await service.extractEntities('I need size XL');
      expect(result.sizes).toContain('XL');
    });

    it('extracts money amounts', async () => {
      const result = await service.extractEntities('How much is ₦5,000?');
      expect(result.amounts).toContain(5000);
    });

    it('extracts phone numbers', async () => {
      const result = await service.extractEntities('Call me at 08012345678');
      expect(result.phoneNumbers.length).toBeGreaterThan(0);
    });

    it('extracts number words', async () => {
      const result = await service.extractEntities('I want two pairs');
      expect(result.quantities).toContain(2);
    });

    it('extracts naira amounts with k suffix', async () => {
      const result = await service.extractEntities('The price is 5k');
      expect(result.amounts).toContain(5000);
    });

    it('returns empty arrays for no matches', async () => {
      const result = await service.extractEntities('hello');
      expect(result.quantities).toEqual([]);
      expect(result.colors).toEqual([]);
      expect(result.sizes).toEqual([]);
      expect(result.amounts).toEqual([]);
    });
  });

  describe('trainEntityExtractor', () => {
    it('stores training data', async () => {
      const result = await service.trainEntityExtractor('store_1', 'color', [
        { text: 'red shoes', entities: { color: 'red' } },
        { text: 'blue dress', entities: { color: 'blue' } },
      ]);
      expect(result.status).toBe('stored');
      expect(result.entityType).toBe('color');
    });
  });

  describe('evaluateEntityExtractor', () => {
    it('calculates accuracy', async () => {
      const result = await service.evaluateEntityExtractor('color', [
        { text: 'red shoes', expectedEntities: { color: 'red' } },
        { text: 'blue dress', expectedEntities: { color: 'blue' } },
      ]);
      expect(typeof result.accuracy).toBe('number');
      expect(result.total).toBe(2);
      expect(Array.isArray(result.details)).toBe(true);
    });
  });
});
