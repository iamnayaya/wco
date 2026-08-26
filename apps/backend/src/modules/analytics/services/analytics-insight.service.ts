import type { AnalyticsInsight } from '@prisma/client';
import { NotFoundError, ConflictError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';
import { analyticsMetricService } from './analytics-metric.service.js';

/**
 * AnalyticsInsightService — AI-generated business insights, anomaly detection,
 * and actionable recommendations.
 */
export class AnalyticsInsightService {
  constructor(private readonly db: typeof prisma = prisma) {}

  /**
   * Generate insights by analyzing store data patterns.
   * This is a deterministic rule-based system (production would use LLM).
   */
  async generate(storeId: string, options: {
    dateFrom?: string;
    dateTo?: string;
    types?: string[];
  } = {}): Promise<AnalyticsInsight[]> {
    const dateFrom = options.dateFrom ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
    const dateTo = options.dateTo ?? new Date().toISOString();
    const types = new Set(options.types ?? ['TREND', 'ANOMALY', 'OPPORTUNITY', 'RISK', 'RECOMMENDATION']);

    const insights: Array<{
      insightType: string;
      severity: string;
      title: string;
      body: string;
      data: Record<string, unknown>;
      actionUrl?: string;
      actionLabel?: string;
    }> = [];

    // Parallel data fetches
    const [sales, customers, products, payments] = await Promise.all([
      analyticsMetricService.calculateSalesMetrics(storeId, dateFrom, dateTo),
      analyticsMetricService.calculateCustomerMetrics(storeId, dateFrom, dateTo),
      analyticsMetricService.calculateProductMetrics(storeId, dateFrom, dateTo),
      analyticsMetricService.calculatePaymentMetrics(storeId, dateFrom, dateTo),
    ]);

    // TREND: Revenue growth
    if (types.has('TREND')) {
      const revenueGrowth = sales.revenueGrowth as number;
      if (revenueGrowth > 10) {
        insights.push({
          insightType: 'TREND',
          severity: 'INFO',
          title: 'Revenue is growing strongly',
          body: `Revenue grew ${revenueGrowth.toFixed(1)}% compared to the previous period. Keep up the momentum!`,
          data: { metric: 'revenue', growth: revenueGrowth },
          actionUrl: '/analytics/metrics/sales',
          actionLabel: 'View Sales',
        });
      } else if (revenueGrowth < -10) {
        insights.push({
          insightType: 'TREND',
          severity: 'HIGH',
          title: 'Revenue is declining',
          body: `Revenue dropped ${Math.abs(revenueGrowth).toFixed(1)}% compared to the previous period. Consider reviewing pricing or marketing strategies.`,
          data: { metric: 'revenue', growth: revenueGrowth },
          actionUrl: '/analytics/metrics/sales',
          actionLabel: 'View Sales',
        });
      }

      // Customer acquisition trend
      const acquisitionGrowth = customers.acquisitionGrowth as number;
      if (acquisitionGrowth > 20) {
        insights.push({
          insightType: 'TREND',
          severity: 'INFO',
          title: 'Customer acquisition accelerating',
          body: `New customer sign-ups grew ${acquisitionGrowth.toFixed(1)}% vs. the prior period.`,
          data: { metric: 'customer_acquisition', growth: acquisitionGrowth },
        });
      }
    }

    // OPPORTUNITY: Top products
    if (types.has('OPPORTUNITY')) {
      const topSelling = products.topSelling as Array<{ productId: string; quantitySold: number; revenue: number }>;
      if (topSelling.length > 0) {
        const top = topSelling[0];
        insights.push({
          insightType: 'OPPORTUNITY',
          severity: 'LOW',
          title: 'Top selling product identified',
          body: `Product ${top.productId} is your best seller with ${top.quantitySold} units sold. Consider featuring it prominently or creating bundle offers.`,
          data: { productId: top.productId, quantitySold: top.quantitySold, revenue: top.revenue },
          actionUrl: `/products/${top.productId}`,
          actionLabel: 'View Product',
        });
      }
    }

    // RISK: Low payment success rate
    if (types.has('RISK')) {
      const successRate = payments.successRate as number;
      if (successRate < 80 && (payments.totalPayments as number) > 10) {
        insights.push({
          insightType: 'RISK',
          severity: 'HIGH',
          title: 'Low payment success rate',
          body: `Payment success rate is ${successRate.toFixed(1)}%. This may indicate issues with your payment provider or checkout flow.`,
          data: { metric: 'payment_success_rate', value: successRate },
          actionUrl: '/analytics/metrics/payments',
          actionLabel: 'View Payments',
        });
      }

      // Low customer retention
      const retentionRate = customers.retentionRate as number;
      if (retentionRate < 20 && (customers.totalCustomers as number) > 20) {
        insights.push({
          insightType: 'RISK',
          severity: 'MEDIUM',
          title: 'Low customer retention rate',
          body: `Only ${retentionRate.toFixed(1)}% of customers are returning. Consider implementing loyalty programs or follow-up campaigns.`,
          data: { metric: 'retention_rate', value: retentionRate },
        });
      }
    }

    // ANOMALY: Detect unusual patterns
    if (types.has('ANOMALY')) {
      const orderGrowth = sales.orderGrowth as number;
      if (Math.abs(orderGrowth) > 50) {
        insights.push({
          insightType: 'ANOMALY',
          severity: orderGrowth > 0 ? 'INFO' : 'HIGH',
          title: `Unusual order volume ${orderGrowth > 0 ? 'spike' : 'drop'}`,
          body: `Order volume changed by ${orderGrowth.toFixed(1)}% — this is significantly different from the typical range.`,
          data: { metric: 'order_growth', value: orderGrowth },
          actionUrl: '/analytics/metrics/sales',
          actionLabel: 'View Sales',
        });
      }
    }

    // RECOMMENDATION
    if (types.has('RECOMMENDATION')) {
      const avgOrderValue = sales.averageOrderValue as number;
      if (avgOrderValue > 0 && (sales.totalOrders as number) > 50) {
        insights.push({
          insightType: 'RECOMMENDATION',
          severity: 'LOW',
          title: 'Consider upselling to increase AOV',
          body: `Your average order value is ₦${avgOrderValue.toLocaleString()}. Adding complementary product suggestions could increase this by 15-25%.`,
          data: { metric: 'avg_order_value', value: avgOrderValue },
        });
      }
    }

    // Persist and return
    if (insights.length === 0) return [];

    const created = await this.db.$transaction(
      insights.map((i) =>
        this.db.analyticsInsight.create({
          data: {
            storeId,
            insightType: i.insightType as never,
            severity: i.severity as never,
            title: i.title,
            body: i.body,
            data: i.data as never,
            actionUrl: i.actionUrl,
            actionLabel: i.actionLabel,
          },
        }),
      ),
    );

    logger.info('Analytics insights generated', { storeId, count: created.length });
    return created;
  }

  async getById(storeId: string, id: string): Promise<AnalyticsInsight> {
    const insight = await this.db.analyticsInsight.findFirst({ where: { id, storeId } });
    if (!insight) throw new NotFoundError('Analytics insight');
    return insight;
  }

  async list(
    storeId: string,
    page: number,
    pageSize: number,
    filters: {
      insightType?: string;
      severity?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: string;
    } = {},
  ): Promise<AnalyticsInsight[]> {
    const where: Record<string, unknown> = { storeId };
    if (filters.insightType) where.insightType = filters.insightType;
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;

    const orderBy: Record<string, string> = {};
    orderBy[filters.sortBy ?? 'createdAt'] = filters.sortOrder ?? 'desc';

    return this.db.analyticsInsight.findMany({
      where: where as never,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async count(storeId: string, filters: {
    insightType?: string;
    severity?: string;
    status?: string;
  } = {}): Promise<number> {
    const where: Record<string, unknown> = { storeId };
    if (filters.insightType) where.insightType = filters.insightType;
    if (filters.severity) where.severity = filters.severity;
    if (filters.status) where.status = filters.status;
    return this.db.analyticsInsight.count({ where: where as never });
  }

  async dismiss(storeId: string, id: string): Promise<AnalyticsInsight> {
    const insight = await this.getById(storeId, id);
    if (insight.status !== 'ACTIVE') throw new ConflictError('Only active insights can be dismissed');
    return this.db.analyticsInsight.update({
      where: { id },
      data: { status: 'DISMISSED', dismissedAt: new Date() },
    });
  }

  async act(storeId: string, id: string, action: string): Promise<AnalyticsInsight> {
    const insight = await this.getById(storeId, id);
    if (insight.status !== 'ACTIVE') throw new ConflictError('Only active insights can be acted upon');
    return this.db.analyticsInsight.update({
      where: { id },
      data: {
        status: 'ACTED_UPON',
        actedAt: new Date(),
        data: { ...(insight.data as Record<string, unknown>), actionTaken: action },
      },
    });
  }
}

export const analyticsInsightService = new AnalyticsInsightService();
