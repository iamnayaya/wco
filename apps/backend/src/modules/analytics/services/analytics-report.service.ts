import type { AnalyticsReport } from '@prisma/client';
import { NotFoundError, ConflictError, ValidationError } from '@wco/shared';

import { logger } from '../../../lib/logger.js';
import { prisma } from '../../../lib/prisma.js';
import { analyticsMetricService } from './analytics-metric.service.js';

/**
 * AnalyticsReportService — on-demand and scheduled report generation.
 *
 * Reports are generated asynchronously: the initial POST returns PENDING
 * immediately, then the actual computation runs. For this implementation
 * we generate inline (synchronous), but the interface supports async.
 */
export class AnalyticsReportService {
  constructor(private readonly db: typeof prisma = prisma) {}

  async generate(
    storeId: string,
    reportType: string,
    dateFrom: string,
    dateTo: string,
    format: string = 'JSON',
    parameters: Record<string, unknown> = {},
  ): Promise<AnalyticsReport> {
    // Validate date range
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (from >= to) throw new ValidationError('dateFrom must be before dateTo');

    const report = await this.db.analyticsReport.create({
      data: {
        storeId,
        reportType: reportType as never,
        format: format as never,
        status: 'GENERATING',
        dateFrom: from,
        dateTo: to,
        parameters: parameters as never,
      },
    });

    try {
      const result = await this.computeReport(storeId, reportType, from, to, parameters);
      return this.db.analyticsReport.update({
        where: { id: report.id },
        data: {
          status: 'COMPLETED',
          result: result as never,
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Report generation failed', { reportId: report.id, error });
      return this.db.analyticsReport.update({
        where: { id: report.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async schedule(
    storeId: string,
    reportType: string,
    frequency: string,
    format: string = 'JSON',
    parameters: Record<string, unknown> = {},
  ): Promise<AnalyticsReport> {
    return this.db.analyticsReport.create({
      data: {
        storeId,
        reportType: reportType as never,
        format: format as never,
        frequency: frequency as never,
        status: 'PENDING',
        dateFrom: new Date(),
        dateTo: new Date(),
        parameters: parameters as never,
        scheduledAt: new Date(),
      },
    });
  }

  async getById(storeId: string, id: string): Promise<AnalyticsReport> {
    const report = await this.db.analyticsReport.findFirst({ where: { id, storeId } });
    if (!report) throw new NotFoundError('Analytics report');
    return report;
  }

  async list(
    storeId: string,
    page: number,
    pageSize: number,
    filters: {
      reportType?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: string;
    } = {},
  ): Promise<AnalyticsReport[]> {
    const where: Record<string, unknown> = { storeId };
    if (filters.reportType) where.reportType = filters.reportType;
    if (filters.status) where.status = filters.status;

    const orderBy: Record<string, string> = {};
    orderBy[filters.sortBy ?? 'createdAt'] = filters.sortOrder ?? 'desc';

    return this.db.analyticsReport.findMany({
      where: where as never,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async count(
    storeId: string,
    filters: { reportType?: string; status?: string } = {},
  ): Promise<number> {
    const where: Record<string, unknown> = { storeId };
    if (filters.reportType) where.reportType = filters.reportType;
    if (filters.status) where.status = filters.status;
    return this.db.analyticsReport.count({ where: where as never });
  }

  async cancelScheduled(storeId: string, id: string): Promise<AnalyticsReport> {
    const report = await this.getById(storeId, id);
    if (report.frequency === 'ONCE') throw new ValidationError('Cannot cancel a one-time report');
    if (report.status !== 'PENDING') throw new ValidationError('Only pending scheduled reports can be cancelled');
    return this.db.analyticsReport.update({
      where: { id },
      data: { status: 'FAILED', error: 'Cancelled by user' },
    });
  }

  private async computeReport(
    storeId: string,
    reportType: string,
    from: Date,
    to: Date,
    parameters: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const dateFrom = from.toISOString();
    const dateTo = to.toISOString();

    switch (reportType) {
      case 'SALES':
        return analyticsMetricService.calculateSalesMetrics(storeId, dateFrom, dateTo);
      case 'CUSTOMERS':
        return analyticsMetricService.calculateCustomerMetrics(storeId, dateFrom, dateTo);
      case 'PRODUCTS':
        return analyticsMetricService.calculateProductMetrics(storeId, dateFrom, dateTo);
      case 'MESSAGES':
        return analyticsMetricService.calculateMessageMetrics(storeId, dateFrom, dateTo);
      case 'PAYMENTS':
        return analyticsMetricService.calculatePaymentMetrics(storeId, dateFrom, dateTo);
      case 'DELIVERIES':
        return analyticsMetricService.calculateDeliveryMetrics(storeId, dateFrom, dateTo);
      case 'COMPREHENSIVE': {
        const [sales, customers, products, messages, payments, deliveries] = await Promise.all([
          analyticsMetricService.calculateSalesMetrics(storeId, dateFrom, dateTo),
          analyticsMetricService.calculateCustomerMetrics(storeId, dateFrom, dateTo),
          analyticsMetricService.calculateProductMetrics(storeId, dateFrom, dateTo),
          analyticsMetricService.calculateMessageMetrics(storeId, dateFrom, dateTo),
          analyticsMetricService.calculatePaymentMetrics(storeId, dateFrom, dateTo),
          analyticsMetricService.calculateDeliveryMetrics(storeId, dateFrom, dateTo),
        ]);
        return { sales, customers, products, messages, payments, deliveries };
      }
      default:
        throw new ValidationError(`Unknown report type: ${reportType}`);
    }
  }
}

export const analyticsReportService = new AnalyticsReportService();
