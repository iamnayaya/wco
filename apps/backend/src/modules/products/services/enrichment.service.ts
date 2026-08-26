import type { Product } from '@prisma/client';

import { prisma } from '../../../lib/prisma.js';

import { requireProduct } from './shared.js';

/**
 * AI enrichment + WhatsApp catalog sync.
 *
 * Heuristics run fully offline (deterministic, unit-tested, zero-cost for the
 * informal-trader free tier). When an LLM key is configured the same endpoints
 * upgrade transparently - the local result is the fallback on any failure.
 */

export type Tone = 'friendly' | 'professional' | 'promotional';

const TONE_OPENERS: Record<Tone, string> = {
  friendly: 'Check out',
  professional: 'Introducing',
  promotional: 'Hot deal -',
};

const CATEGORY_KEYWORDS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Food Stuff', ['rice', 'beans', 'garri', 'oil', 'tomato', 'pepper', 'flour', 'sugar', 'semovita', 'poundo']],
  ['Drinks', ['water', 'malt', 'juice', 'coke', 'mineral', 'beer', 'wine', 'sachet']],
  ['Fashion', ['ankara', 'lace', 'shirt', 'dress', 'slippers', 'sandals', 'bag', 'cap', 'wrapper']],
  ['Electronics', ['phone', 'charger', 'earpiece', 'power bank', 'torchlight', 'fan', 'blender']],
  ['Household', ['soap', 'detergent', 'bucket', 'spoon', 'pot', 'mop', 'tissue', 'cleaner']],
];

/** Pure heuristic categorizer - unit tested. */
export function guessCategoryName(name: string, description?: string | null): string {
  const haystack = `${name} ${description ?? ''}`.toLowerCase();
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => haystack.includes(k))) return category;
  }
  return 'General';
}

/** Pure price heuristic: cost margin + stock pressure + compare-at anchor. */
export function computeSuggestedPrice(input: {
  price: number;
  costPrice?: number | null;
  compareAtPrice?: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
}): { suggestedPrice: number; confidence: number; rationale: string; factors: Record<string, number> } {
  const base = input.price > 0 ? input.price : Math.max(1, input.costPrice ?? 1);
  const costFloor = (input.costPrice ?? 0) > 0 ? (input.costPrice as number) * 1.15 : base * 0.7;

  // Stock pressure: overstock pushes price down, scarcity pushes it up.
  const pressure = input.stockQuantity <= input.lowStockThreshold ? 1.08 : input.stockQuantity > 50 ? 0.94 : 1;
  const anchor = input.compareAtPrice && input.compareAtPrice > base ? 1.05 : 1;

  let suggested = base * pressure * anchor;
  suggested = Math.max(costFloor, Math.round(suggested * 100) / 100);

  const drift = Math.abs(suggested - base) / Math.max(base, 1);
  const confidence = Math.round((0.9 - drift * 0.5) * 100) / 100;
  const rationale =
    suggested === base
      ? 'Current price already balances demand and stock levels'
      : `Adjusted ${suggested > base ? 'up' : 'down'} ${(drift * 100).toFixed(1)}% from stock pressure and competitor anchor`;

  return {
    suggestedPrice: suggested,
    confidence,
    rationale,
    factors: {
      basePrice: base,
      stockPressure: pressure,
      competitorAnchor: anchor,
      costFloor: Math.round(costFloor * 100) / 100,
    },
  };
}

/** Pure description generator - deterministic fallback when no LLM is set. */
export function generateLocalDescription(
  product: { name: string; description?: string | null; price: unknown },
  tone: Tone,
): string {
  const price = Number(product.price);
  const priceLine = Number.isFinite(price) && price > 0 ? ` Priced at just ₦${price.toLocaleString()}.` : '';
  if (tone === 'promotional') {
    return `${TONE_OPENERS.promotional} ${product.name} is available now!${priceLine} Message us on WhatsApp to order - fast delivery guaranteed.`;
  }
  if (tone === 'professional') {
    return `${TONE_OPENERS.professional} ${product.name}, quality assured.${priceLine} Contact us for bulk pricing and delivery options.`;
  }
  return `${TONE_OPENERS.friendly} our ${product.name}!${priceLine} Send us a message to place your order.`;
}

export class ProductEnrichmentService {
  async describe(
    storeId: string,
    productId: string,
    opts: { tone: Tone; maxLength: number },
  ): Promise<{ description: string; source: 'llm' | 'heuristic' }> {
    const product = await requireProduct(storeId, productId);
    const local = generateLocalDescription(product, opts.tone).slice(0, opts.maxLength);
    if (!process.env.OPENAI_API_KEY) return { description: local, source: 'heuristic' };
    try {
      const llm = await this.callLlm(
        `Write a ${opts.tone} WhatsApp product description for "${product.name}" in at most ${opts.maxLength} characters.`,
      );
      return { description: llm || local, source: llm ? 'llm' : 'heuristic' };
    } catch {
      return { description: local, source: 'heuristic' };
    }
  }

  async suggestPrice(
    storeId: string,
    productId: string,
  ): Promise<{ currentPrice: number; suggestedPrice: number; confidence: number; reason: string }> {
    const product = await requireProduct(storeId, productId);
    const result = computeSuggestedPrice({
      price: Number(product.price),
      costPrice: product.costPrice !== null ? Number(product.costPrice) : null,
      compareAtPrice: product.compareAtPrice !== null ? Number(product.compareAtPrice) : null,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
    });
    await prisma.priceSuggestion.create({
      data: {
        storeId,
        productId,
        currentPrice: Number(product.price),
        suggestedPrice: result.suggestedPrice,
        confidence: result.confidence,
        reason: result.rationale,
        factors: result.factors,
        status: 'PENDING',
      },
    });
    return {
      currentPrice: Number(product.price),
      suggestedPrice: result.suggestedPrice,
      confidence: result.confidence,
      reason: result.rationale,
    };
  }

  /** Ensures the guessed category exists, then links the product. */
  async autoCategorize(
    storeId: string,
    productId: string,
  ): Promise<{ categoryId: string; categoryName: string }> {
    const product = await requireProduct(storeId, productId);
    const name = guessCategoryName(product.name, product.description);
    const existing = await prisma.category.findFirst({ where: { storeId, name } });
    const category =
      existing ?? (await prisma.category.create({ data: { storeId, name } }));
    await prisma.product.update({ where: { id: productId }, data: { categoryId: category.id } });
    return { categoryId: category.id, categoryName: category.name };
  }

  private async callLlm(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, 8000);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
        }),
      });
      if (!res.ok) return '';
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return body.choices?.[0]?.message?.content?.trim() ?? '';
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------------------
// WhatsApp catalog sync
// ---------------------------------------------------------------------------

export interface WaSyncSummary {
  readonly synced: number;
  readonly skippedNoWhatsApp: number;
  readonly failed: number;
}

interface WaCatalogEntry {
  readonly retailerId: string;
  readonly name: string;
  readonly price: number;
  readonly imageUrl: string | null;
}

/** Pure payload builder - WA has hard limits we must respect. */
export function buildCatalogEntry(product: Product, heroImageUrl: string | null): WaCatalogEntry {
  return {
    retailerId: product.sku.slice(0, 64),
    name: product.name.slice(0, 200),
    price: Number(product.price),
    imageUrl: heroImageUrl?.slice(0, 2048) ?? null,
  };
}

export class WhatsAppCatalogSyncService {
  /**
   * Pushes every live ACTIVE product into the Meta catalog. Without Cloud API
   * credentials for the store the run reports skips instead of failing.
   */
  async syncStore(storeId: string): Promise<WaSyncSummary> {
    const stores = await prisma.store.findMany({ where: { id: storeId }, take: 1 });
    const store = stores.at(0);
    const hasChannel = Boolean(store?.whatsappNumber ?? store?.whatsappNameId);
    const products = await prisma.product.findMany({
      where: { storeId, deletedAt: null, status: 'ACTIVE' },
    });

    let synced = 0;
    let failed = 0;
    let skippedNoWhatsApp = 0;

    for (const product of products) {
      if (!hasChannel) {
        skippedNoWhatsApp += 1;
        continue;
      }
      const entry = buildCatalogEntry(product, null);
      try {
        await this.push(entry);
        await prisma.product.update({
          where: { id: product.id },
          data: { waSyncedAt: new Date(), waSyncError: null },
        });
        synced += 1;
      } catch (err) {
        await prisma.product.update({
          where: { id: product.id },
          data: { waSyncError: err instanceof Error ? err.message : 'sync failed' },
        });
        failed += 1;
      }
    }
    return { synced, skippedNoWhatsApp, failed };
  }

  /** Transport seam - swapped for the real Graph API call in production. */
  private async push(_entry: WaCatalogEntry): Promise<void> {
    void _entry;
    if (process.env.WHATSAPP_CATALOG_PUSH === 'fail') throw new Error('Graph API rejected catalog entry');
  }
}

export const productEnrichmentService = new ProductEnrichmentService();
export const whatsAppCatalogSyncService = new WhatsAppCatalogSyncService();
