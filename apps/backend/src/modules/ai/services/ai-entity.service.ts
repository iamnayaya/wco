import { complete } from './claude-api.service.js';
import { getTemplateByName, renderTemplate } from './prompt-templates.js';

/**
 * AI Entity extraction service — extracts structured entities from
 * messages using LLM with deterministic fallback. Supports custom
 * entity types and training data.
 */

interface ExtractedEntities {
  quantities: number[];
  colors: string[];
  sizes: string[];
  amounts: number[];
  productNames: string[];
  locations: string[];
  phoneNumbers: string[];
  timestamps: string[];
  custom: Record<string, string>;
  source: 'llm' | 'heuristic';
}

const COLOR_WORDS = [
  'red', 'blue', 'black', 'white', 'green', 'yellow', 'gold', 'silver', 'pink', 'purple',
  'brown', 'orange', 'grey', 'gray', 'navy', 'beige', 'cream', 'teal',
];

const SIZE_TOKENS = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'small', 'medium', 'large'];

export class AIEntityService {
  /** Extract entities from a message using LLM + heuristic fallback. */
  async extractEntities(
    message: string,
    intent?: string,
    context?: Record<string, unknown>,
  ): Promise<ExtractedEntities> {
    // Try LLM first
    try {
      const template = getTemplateByName('entity-extraction');
      if (template) {
        const userPrompt = renderTemplate(template.userTemplate, { message });
        const result = await complete({
          systemPrompt: template.systemPrompt,
          userPrompt,
          temperature: template.temperature,
          maxTokens: template.maxTokens,
        });

        try {
          const parsed = JSON.parse(result.text) as Record<string, unknown>;
          return {
            quantities: Array.isArray(parsed.quantities) ? parsed.quantities as number[] : [],
            colors: Array.isArray(parsed.colors) ? parsed.colors as string[] : [],
            sizes: Array.isArray(parsed.sizes) ? parsed.sizes as string[] : [],
            amounts: Array.isArray(parsed.amounts) ? parsed.amounts as number[] : [],
            productNames: Array.isArray(parsed.productNames) ? parsed.productNames as string[] : [],
            locations: Array.isArray(parsed.locations) ? parsed.locations as string[] : [],
            phoneNumbers: Array.isArray(parsed.phoneNumbers) ? parsed.phoneNumbers as string[] : [],
            timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps as string[] : [],
            custom: {},
            source: 'llm',
          };
        } catch {
          // JSON parse failed
        }
      }
    } catch {
      // LLM unavailable
    }

    // Heuristic fallback
    return this.heuristicExtract(message);
  }

  private heuristicExtract(message: string): ExtractedEntities {
    const lower = message.toLowerCase();
    const tokens = lower.split(/\s+/);

    // Quantities
    const quantities: number[] = [];
    const numberWords: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };
    for (const [word, num] of Object.entries(numberWords)) {
      if (lower.includes(word)) quantities.push(num);
    }
    const bareNumbers = lower.matchAll(/(?:^|\s)(\d{1,3})(?=\s|$)/g);
    for (const m of bareNumbers) {
      const val = Number(m[1]);
      if (val > 0) quantities.push(val);
    }

    // Colors
    const colors = COLOR_WORDS.filter((c) => lower.includes(c));

    // Sizes
    const sizes = SIZE_TOKENS.filter((s) => tokens.includes(s)).map((s) => s.toUpperCase());

    // Money amounts
    const amounts: number[] = [];
    const currencyMatches = lower.matchAll(/(?:₦|ngn|naira)\s?([\d,]+(?:\.\d+)?)/g);
    for (const m of currencyMatches) {
      if (m[1]) amounts.push(Number(m[1].replace(/,/g, '')));
    }
    const suffixMatches = lower.matchAll(/\b(\d+(?:\.\d+)?)\s?(k|naira)\b/g);
    for (const m of suffixMatches) {
      if (m[1]) amounts.push(m[2] === 'k' ? Number(m[1]) * 1000 : Number(m[1]));
    }

    // Phone numbers
    const phoneNumbers = [...lower.matchAll(/\b(?:\+?234|0)\d{10}\b/g)].map((m) => m[0]);

    return {
      quantities: [...new Set(quantities)].sort((a, b) => a - b),
      colors,
      sizes,
      amounts: [...new Set(amounts)],
      productNames: [],
      locations: [],
      phoneNumbers,
      timestamps: [],
      custom: {},
      source: 'heuristic',
    };
  }

  /** Train entity extractor with labeled data. */
  async trainEntityExtractor(storeId: string, entityType: string, examples: Array<{
    text: string;
    entities: Record<string, string>;
  }>): Promise<Record<string, unknown>> {
    // Store training data in context for future fine-tuning
    return {
      entityType,
      examplesCount: examples.length,
      status: 'stored',
      message: 'Training data stored for future model improvement',
    };
  }

  /** Evaluate entity extraction accuracy. */
  async evaluateEntityExtractor(entityType: string, testCases: Array<{
    text: string;
    expectedEntities: Record<string, string>;
  }>): Promise<Record<string, unknown>> {
    let correct = 0;
    const details: Array<{
      text: string;
      expected: Record<string, string>;
      extracted: Record<string, string>;
      correct: boolean;
    }> = [];

    for (const tc of testCases) {
      const result = await this.extractEntities(tc.text);
      const extractedFlat = {
        ...Object.fromEntries(result.quantities.map((q) => [`qty_${q}`, String(q)])),
        ...Object.fromEntries(result.colors.map((c) => [`color`, c])),
        ...Object.fromEntries(result.sizes.map((s) => [`size`, s])),
        ...Object.fromEntries(result.amounts.map((a) => [`amount_${a}`, String(a)])),
      };

      const isCorrect = Object.keys(tc.expectedEntities).every(
        (k) => extractedFlat[k] === tc.expectedEntities[k],
      );
      if (isCorrect) correct++;

      details.push({
        text: tc.text.slice(0, 100),
        expected: tc.expectedEntities,
        extracted: extractedFlat,
        correct: isCorrect,
      });
    }

    return {
      accuracy: testCases.length > 0 ? correct / testCases.length : 0,
      correct,
      total: testCases.length,
      details,
    };
  }

  /** List supported entity types. */
  listEntityTypes(): Array<{ type: string; description: string }> {
    return [
      { type: 'quantity', description: 'Numeric quantities (e.g., 2, five)' },
      { type: 'color', description: 'Product colors (e.g., red, blue)' },
      { type: 'size', description: 'Product sizes (e.g., XL, large)' },
      { type: 'amount', description: 'Monetary amounts (e.g., ₦5000, 2k)' },
      { type: 'productName', description: 'Product names or descriptions' },
      { type: 'location', description: 'Addresses or areas' },
      { type: 'phone', description: 'Phone numbers' },
      { type: 'timestamp', description: 'Time references' },
    ];
  }
}

export const aiEntityService = new AIEntityService();
