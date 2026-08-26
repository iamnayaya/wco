import { PROMPT_TEMPLATES, getTemplateByName, renderTemplate } from '../../src/modules/ai/services/prompt-templates.js';

describe('Prompt Templates', () => {
  describe('PROMPT_TEMPLATES', () => {
    it('contains all required templates', () => {
      expect(PROMPT_TEMPLATES.length).toBeGreaterThanOrEqual(10);
      const names = PROMPT_TEMPLATES.map((t) => t.name);
      expect(names).toContain('auto-responder');
      expect(names).toContain('intent-detection');
      expect(names).toContain('entity-extraction');
      expect(names).toContain('product-description');
      expect(names).toContain('pricing-suggestion');
      expect(names).toContain('customer-segmentation');
      expect(names).toContain('sales-forecast');
      expect(names).toContain('fraud-detection');
      expect(names).toContain('delivery-prediction');
      expect(names).toContain('insights-generation');
      expect(names).toContain('report-generation');
    });

    it('each template has required fields', () => {
      for (const template of PROMPT_TEMPLATES) {
        expect(template.name).toBeTruthy();
        expect(template.category).toBeTruthy();
        expect(template.systemPrompt).toBeTruthy();
        expect(template.userTemplate).toBeTruthy();
        expect(Array.isArray(template.variables)).toBe(true);
        expect(template.language).toBeTruthy();
      }
    });

    it('templates have variable slots', () => {
      const autoResponder = getTemplateByName('auto-responder');
      expect(autoResponder).toBeDefined();
      expect(autoResponder!.systemPrompt).toContain('{{storeName}}');
      expect(autoResponder!.userTemplate).toContain('{{message}}');
    });
  });

  describe('getTemplateByName', () => {
    it('returns template by name', () => {
      const template = getTemplateByName('auto-responder');
      expect(template).toBeDefined();
      expect(template!.name).toBe('auto-responder');
    });

    it('returns undefined for unknown name', () => {
      const template = getTemplateByName('nonexistent');
      expect(template).toBeUndefined();
    });
  });

  describe('renderTemplate', () => {
    it('renders simple variables', () => {
      const result = renderTemplate('Hello {{name}}, welcome to {{store}}!', {
        name: 'John',
        store: 'WCO Shop',
      });
      expect(result).toBe('Hello John, welcome to WCO Shop!');
    });

    it('leaves unresolved variables as-is', () => {
      const result = renderTemplate('Hello {{name}}, your {{item}} is ready.', {
        name: 'John',
      });
      expect(result).toBe('Hello John, your {{item}} is ready.');
    });

    it('handles empty variables', () => {
      const result = renderTemplate('No variables here', {});
      expect(result).toBe('No variables here');
    });

    it('handles multiple same variables', () => {
      const result = renderTemplate('{{greeting}} {{name}}! {{greeting}} again!', {
        greeting: 'Hi',
        name: 'World',
      });
      expect(result).toBe('Hi World! Hi again!');
    });

    it('handles whitespace in variable names', () => {
      const result = renderTemplate('Hello {{ name }}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });
  });
});
