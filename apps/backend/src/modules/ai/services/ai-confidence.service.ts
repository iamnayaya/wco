import type { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma.js';

/**
 * AI Confidence service — calculates and tracks confidence scores
 * for AI responses, manages escalation thresholds per use-case,
 * and provides calibration data for continuous improvement.
 */

interface ConfidenceFactors {
  responseLength: number;
  hasEntities: boolean;
  isKnownIntent: boolean;
  historicalAccuracy: number;
  contextRelevance: number;
  languageMatch: boolean;
}

const DEFAULT_THRESHOLDS: Record<string, number> = {
  auto_response: 0.6,
  product_description: 0.7,
  pricing_suggestion: 0.8,
  customer_segment: 0.65,
  sales_forecast: 0.6,
  fraud_detection: 0.75,
  delivery_prediction: 0.65,
  insights: 0.7,
  report: 0.7,
  intent_detection: 0.6,
  entity_extraction: 0.6,
};

export class AIConfidenceService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /** Calculate confidence score for an AI response. */
  calculateConfidence(
    response: string,
    context?: Record<string, unknown>,
    historicalData?: { accuracy?: number; escalationRate?: number },
  ): number {
    let confidence = 0.5; // base

    // Response quality signals
    if (response.length > 20) confidence += 0.05;
    if (response.length > 100) confidence += 0.05;
    if (response.length > 300) confidence += 0.05;

    // Hedging language penalty
    const lower = response.toLowerCase();
    const hedging = ['i think', 'maybe', 'not sure', 'possibly', 'might be', 'i guess'];
    const certainty = ['definitely', 'certainly', 'absolutely', 'the answer is', 'yes,'];
    const hedgeCount = hedging.filter((h) => lower.includes(h)).length;
    const certCount = certainty.filter((c) => lower.includes(c)).length;
    confidence -= hedgeCount * 0.08;
    confidence += certCount * 0.05;

    // Historical accuracy boost
    if (historicalData?.accuracy) {
      confidence = confidence * 0.7 + historicalData.accuracy * 0.3;
    }

    // Context presence bonus
    if (context && Object.keys(context).length > 0) {
      confidence += 0.05;
    }

    // JSON response bonus (structured outputs are more reliable)
    try {
      JSON.parse(response);
      confidence += 0.05;
    } catch {
      // Not JSON — no bonus
    }

    return Math.max(0.05, Math.min(0.99, confidence));
  }

  /** Get the confidence threshold for a use-case. */
  async getThreshold(storeId: string, useCase: string): Promise<number> {
    // Check if store has a custom threshold in AiConfiguration
    const config = await this.db.aiConfiguration.findUnique({ where: { storeId } });
    if (useCase === 'auto_response' && config) {
      return Number(config.confidenceThreshold);
    }
    return DEFAULT_THRESHOLDS[useCase] ?? 0.6;
  }

  /** Update the confidence threshold for a use-case. */
  async updateThreshold(storeId: string, useCase: string, threshold: number): Promise<void> {
    // For auto_response, update the store's AI configuration
    if (useCase === 'auto_response') {
      await this.db.aiConfiguration.upsert({
        where: { storeId },
        create: { storeId, confidenceThreshold: threshold },
        update: { confidenceThreshold: threshold },
      });
    }
    // For other use-cases, store in the score table for tracking
    // (threshold is embedded in each score record)
  }

  /** Determine if a response should be escalated to a human. */
  shouldEscalate(confidence: number, threshold: number): boolean {
    return confidence < threshold;
  }

  /** Log a confidence score. */
  async logScore(storeId: string, data: {
    useCase: string;
    confidence: number;
    threshold: number;
    escalated: boolean;
    responseId?: string;
    context?: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    return this.db.aIConfidenceScore.create({
      data: {
        storeId,
        useCase: data.useCase,
        confidence: data.confidence,
        threshold: data.threshold,
        escalated: data.escalated,
        responseId: data.responseId ?? null,
        context: JSON.stringify(data.context ?? {}),
      },
    });
  }

  /** Get confidence statistics for a use-case. */
  async getStats(storeId: string, useCase: string, days = 30): Promise<Record<string, unknown>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [scores, escalations] = await Promise.all([
      this.db.aIConfidenceScore.aggregate({
        where: { storeId, useCase, createdAt: { gte: since } },
        _avg: { confidence: true },
        _min: { confidence: true },
        _max: { confidence: true },
        _count: { id: true },
      }),
      this.db.aIConfidenceScore.count({
        where: { storeId, useCase, escalated: true, createdAt: { gte: since } },
      }),
    ]);

    const avgConfidence = scores._avg.confidence ?? 0;
    const threshold = await this.getThreshold(storeId, useCase);

    return {
      useCase,
      period: `${days}d`,
      totalResponses: scores._count.id,
      avgConfidence: Math.round(avgConfidence * 1000) / 1000,
      minConfidence: scores._min.confidence ?? 0,
      maxConfidence: scores._max.confidence ?? 0,
      escalationCount: escalations,
      escalationRate: scores._count.id > 0
        ? Math.round((escalations / scores._count.id) * 10000) / 100
        : 0,
      threshold,
    };
  }

  /** List all tracked use-cases with their current thresholds. */
  async listThresholds(storeId: string): Promise<Record<string, unknown>[]> {
    const config = await this.db.aiConfiguration.findUnique({ where: { storeId } });
    return Object.entries(DEFAULT_THRESHOLDS).map(([useCase, defaultThreshold]) => ({
      useCase,
      threshold: useCase === 'auto_response' && config
        ? Number(config.confidenceThreshold)
        : defaultThreshold,
      isCustom: useCase === 'auto_response',
    }));
  }
}

export const aiConfidenceService = new AIConfidenceService();
