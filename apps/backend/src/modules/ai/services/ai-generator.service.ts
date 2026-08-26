import type { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma.js';
import { complete } from './claude-api.service.js';
import { aiConfidenceService } from './ai-confidence.service.js';
import { aiContextService } from './ai-context.service.js';
import {
  PROMPT_TEMPLATES,
  getTemplateByName,
  renderTemplate,
} from './prompt-templates.js';

/**
 * AI Response Generator service — high-level AI generation features
 * that combine LLM calls with business data for each use-case.
 */

export class AIResponseGeneratorService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /** Generate an auto-response for a customer message. */
  async generateAutoResponse(storeId: string, input: {
    message: string;
    threadId?: string;
    tone?: string;
    language?: string;
    context?: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const [store, config] = await Promise.all([
      this.db.store.findUnique({ where: { id: storeId }, select: { name: true } }),
      this.db.aiConfiguration.findUnique({ where: { storeId } }),
    ]);

    const storeName = store?.name ?? 'our store';
    const tone = input.tone ?? config?.tone ?? 'FRIENDLY';
    const language = input.language ?? 'en';

    // Get product context
    const products = await this.db.product.findMany({
      where: { storeId, status: 'ACTIVE' },
      select: { name: true, price: true },
      take: 5,
    });
    const catalogContext = products.length > 0
      ? `Available products: ${products.map((p) => `${p.name} (₦${p.price})`).join(', ')}.`
      : '';

    // Get conversation context if thread provided
    let conversationHistory = '';
    if (input.threadId) {
      try {
        const history = await aiContextService.getContextHistory(storeId, input.threadId, 5);
        conversationHistory = history.map((h) => `${h.role}: ${h.content}`).join('\n');
      } catch {
        // No context yet
      }
    }

    const template = getTemplateByName('auto-responder');
    const systemPrompt = template
      ? renderTemplate(template.systemPrompt, {
          storeName,
          tone: String(tone),
          language,
          businessContext: config?.businessContext ?? '',
          catalogContext,
        })
      : `You are the WhatsApp sales assistant for ${storeName}. Be helpful and concise.`;

    const userPrompt = conversationHistory
      ? `Previous conversation:\n${conversationHistory}\n\nCustomer says: "${input.message}". Draft one helpful reply.`
      : `Customer says: "${input.message}". Draft one helpful reply.`;

    const result = await complete({
      systemPrompt,
      userPrompt,
      temperature: template?.temperature ?? 0.7,
      maxTokens: template?.maxTokens ?? 256,
    });

    // Calculate confidence
    const confidence = aiConfidenceService.calculateConfidence(result.text, input.context);

    // Check escalation
    const threshold = await aiConfidenceService.getThreshold(storeId, 'auto_response');
    const escalated = aiConfidenceService.shouldEscalate(confidence, threshold);

    // Log confidence score
    aiConfidenceService.logScore(storeId, {
      useCase: 'auto_response',
      confidence,
      threshold,
      escalated,
      context: input.context,
    }).catch(() => undefined);

    // Update context
    if (input.threadId) {
      aiContextService.updateContext(storeId, input.threadId, input.message, 'user').catch(() => undefined);
      aiContextService.updateContext(storeId, input.threadId, result.text, 'assistant').catch(() => undefined);
    }

    return {
      response: result.text,
      confidence,
      escalated,
      threshold,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      storeName,
      tone,
      language,
    };
  }

  /** Generate a product description. */
  async generateProductDescription(storeId: string, input: {
    productName: string;
    category?: string;
    price?: number;
    features?: string[];
    targetAudience?: string;
    language?: string;
    tone?: string;
  }): Promise<Record<string, unknown>> {
    const template = getTemplateByName('product-description');
    const userPrompt = renderTemplate(template?.userTemplate ?? '', {
      productName: input.productName,
      category: input.category ?? 'General',
      price: input.price ? `₦${input.price}` : 'N/A',
      features: (input.features ?? []).join(', ') || 'N/A',
      audience: input.targetAudience ?? 'General customers',
    });

    const result = await complete({
      systemPrompt: template?.systemPrompt ?? 'Write a product description.',
      userPrompt,
      temperature: template?.temperature ?? 0.8,
      maxTokens: template?.maxTokens ?? 512,
    });

    const confidence = aiConfidenceService.calculateConfidence(result.text);
    return {
      description: result.text,
      confidence,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
    };
  }

  /** Generate a pricing suggestion. */
  async generatePricingSuggestion(storeId: string, input: {
    productName: string;
    currentPrice: number;
    costPrice: number;
    category?: string;
    competitorPrices?: number[];
    demand?: string;
    position?: string;
  }): Promise<Record<string, unknown>> {
    const template = getTemplateByName('pricing-suggestion');
    const userPrompt = renderTemplate(template?.userTemplate ?? '', {
      productName: input.productName,
      currentPrice: `₦${input.currentPrice}`,
      costPrice: `₦${input.costPrice}`,
      category: input.category ?? 'General',
      competitorPrices: (input.competitorPrices ?? []).map((p) => `₦${p}`).join(', ') || 'N/A',
      demand: input.demand ?? 'medium',
      position: input.position ?? 'mid',
    });

    const result = await complete({
      systemPrompt: template?.systemPrompt ?? 'Suggest pricing.',
      userPrompt,
      temperature: template?.temperature ?? 0.3,
      maxTokens: template?.maxTokens ?? 400,
    });

    try {
      const parsed = JSON.parse(result.text) as Record<string, unknown>;
      return { ...parsed, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    } catch {
      return { raw: result.text, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    }
  }

  /** Generate a customer segment assignment. */
  async generateCustomerSegment(storeId: string, input: {
    customerName: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string;
    avgOrderValue: number;
    preferredCategory?: string;
  }): Promise<Record<string, unknown>> {
    const template = getTemplateByName('customer-segmentation');
    const userPrompt = renderTemplate(template?.userTemplate ?? '', {
      customerName: input.customerName,
      totalOrders: String(input.totalOrders),
      totalSpent: `₦${input.totalSpent}`,
      lastOrderDate: input.lastOrderDate,
      avgOrderValue: `₦${input.avgOrderValue}`,
      preferredCategory: input.preferredCategory ?? 'N/A',
    });

    const result = await complete({
      systemPrompt: template?.systemPrompt ?? 'Segment the customer.',
      userPrompt,
      temperature: template?.temperature ?? 0.2,
      maxTokens: template?.maxTokens ?? 300,
    });

    try {
      const parsed = JSON.parse(result.text) as Record<string, unknown>;
      return { ...parsed, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    } catch {
      return { raw: result.text, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    }
  }

  /** Generate a sales forecast. */
  async generateSalesForecast(storeId: string, input: {
    period: string;
    lookbackDays?: number;
    topProducts?: string[];
    season?: string;
    externalFactors?: string[];
  }): Promise<Record<string, unknown>> {
    // Pull actual metrics
    const [revenue, orders] = await Promise.all([
      this.db.order.aggregate({
        where: {
          storeId,
          status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] },
          createdAt: { gte: new Date(Date.now() - (input.lookbackDays ?? 30) * 86400000) },
        },
        _sum: { total: true },
        _count: { id: true },
      }),
      this.db.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: { storeId, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
        },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const template = getTemplateByName('sales-forecast');
    const userPrompt = renderTemplate(template?.userTemplate ?? '', {
      period: input.period,
      lookback: `${input.lookbackDays ?? 30} days`,
      historicalRevenue: `₦${revenue._sum.total ?? 0} from ${revenue._count.id} orders`,
      orderTrend: orders.map((o) => `Product ${o.productId}: ${o._sum.quantity} units`).join(', ') || 'No data',
      topProducts: (input.topProducts ?? []).join(', ') || 'N/A',
      season: input.season ?? 'N/A',
      externalFactors: (input.externalFactors ?? []).join(', ') || 'None',
    });

    const result = await complete({
      systemPrompt: template?.systemPrompt ?? 'Forecast sales.',
      userPrompt,
      temperature: template?.temperature ?? 0.3,
      maxTokens: template?.maxTokens ?? 500,
    });

    try {
      const parsed = JSON.parse(result.text) as Record<string, unknown>;
      return { ...parsed, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    } catch {
      return { raw: result.text, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    }
  }

  /** Generate fraud detection analysis. */
  async generateFraudDetection(storeId: string, input: {
    orderId: string;
    amount: number;
    paymentMethod: string;
    customerName?: string;
    shippingAddress?: string;
    orderHistory?: string;
    paymentVelocity?: string;
  }): Promise<Record<string, unknown>> {
    const template = getTemplateByName('fraud-detection');
    const userPrompt = renderTemplate(template?.userTemplate ?? '', {
      orderId: input.orderId,
      amount: `₦${input.amount}`,
      paymentMethod: input.paymentMethod,
      customerName: input.customerName ?? 'N/A',
      shippingAddress: input.shippingAddress ?? 'N/A',
      orderHistory: input.orderHistory ?? 'N/A',
      paymentVelocity: input.paymentVelocity ?? 'N/A',
    });

    const result = await complete({
      systemPrompt: template?.systemPrompt ?? 'Analyze for fraud.',
      userPrompt,
      temperature: template?.temperature ?? 0.1,
      maxTokens: template?.maxTokens ?? 400,
    });

    try {
      const parsed = JSON.parse(result.text) as Record<string, unknown>;
      return { ...parsed, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    } catch {
      return { raw: result.text, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    }
  }

  /** Generate delivery time prediction. */
  async generateDeliveryTimePrediction(storeId: string, input: {
    pickupAddress: string;
    dropoffAddress: string;
    carrier?: string;
    timeOfDay?: string;
    dayOfWeek?: string;
    conditions?: string;
  }): Promise<Record<string, unknown>> {
    const template = getTemplateByName('delivery-prediction');
    const userPrompt = renderTemplate(template?.userTemplate ?? '', {
      pickupAddress: input.pickupAddress,
      dropoffAddress: input.dropoffAddress,
      carrier: input.carrier ?? 'Any',
      timeOfDay: input.timeOfDay ?? new Date().toLocaleTimeString(),
      dayOfWeek: input.dayOfWeek ?? new Date().toLocaleDateString('en-US', { weekday: 'long' }),
      conditions: input.conditions ?? 'Normal',
    });

    const result = await complete({
      systemPrompt: template?.systemPrompt ?? 'Predict delivery time.',
      userPrompt,
      temperature: template?.temperature ?? 0.2,
      maxTokens: template?.maxTokens ?? 350,
    });

    try {
      const parsed = JSON.parse(result.text) as Record<string, unknown>;
      return { ...parsed, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    } catch {
      return { raw: result.text, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    }
  }

  /** Generate AI-powered insights from analytics data. */
  async generateInsights(storeId: string, input: {
    period: string;
    metrics?: Record<string, unknown>;
    storeName?: string;
  }): Promise<Record<string, unknown>> {
    const store = input.storeName
      ? { name: input.storeName }
      : await this.db.store.findUnique({ where: { id: storeId }, select: { name: true } });

    // Pull real metrics if not provided
    const [revenueAgg, orderCount, customerCount] = await Promise.all([
      this.db.order.aggregate({
        where: { storeId, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
        _sum: { total: true },
      }),
      this.db.order.count({ where: { storeId } }),
      this.db.customer.count({ where: { storeId } }),
    ]);

    const template = getTemplateByName('insights-generation');
    const userPrompt = renderTemplate(template?.userTemplate ?? '', {
      storeName: store?.name ?? 'Store',
      period: input.period,
      revenue: `₦${revenueAgg._sum.total ?? 0}`,
      orders: String(orderCount),
      customers: String(customerCount),
      conversionRate: 'N/A',
      topProducts: 'N/A',
      trends: JSON.stringify(input.metrics ?? {}),
    });

    const result = await complete({
      systemPrompt: template?.systemPrompt ?? 'Generate insights.',
      userPrompt,
      temperature: template?.temperature ?? 0.5,
      maxTokens: template?.maxTokens ?? 800,
    });

    try {
      const parsed = JSON.parse(result.text) as unknown;
      return { insights: parsed, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    } catch {
      return { insights: result.text, provider: result.provider, model: result.model, latencyMs: result.latencyMs };
    }
  }

  /** Generate a report with AI-powered analysis. */
  async generateReport(storeId: string, input: {
    reportType: string;
    period: string;
    dataSummary: string;
    keyMetrics?: Record<string, unknown>;
    comparisonPeriod?: string;
  }): Promise<Record<string, unknown>> {
    const template = getTemplateByName('report-generation');
    const userPrompt = renderTemplate(template?.userTemplate ?? '', {
      reportType: input.reportType,
      period: input.period,
      dataSummary: input.dataSummary,
      keyMetrics: JSON.stringify(input.keyMetrics ?? {}),
      comparisonPeriod: input.comparisonPeriod ?? 'N/A',
    });

    const result = await complete({
      systemPrompt: template?.systemPrompt ?? 'Generate a report.',
      userPrompt,
      temperature: template?.temperature ?? 0.4,
      maxTokens: template?.maxTokens ?? 1024,
    });

    return {
      report: result.text,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
    };
  }
}

export const aiGeneratorService = new AIResponseGeneratorService();
