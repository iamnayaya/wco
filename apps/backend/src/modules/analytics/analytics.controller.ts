import type { Request, Response } from 'express';

import { getStoreId } from '../../middleware/rbac.js';
import { sendSuccess } from '../../utils/api-response.js';
import { paginationMeta } from '../../utils/offset-pagination.js';

import { analyticsMetricService } from './services/analytics-metric.service.js';
import { analyticsReportService } from './services/analytics-report.service.js';
import { analyticsDashboardService } from './services/analytics-dashboard.service.js';
import { analyticsInsightService } from './services/analytics-insight.service.js';
import { analyticsService } from '../../services/analytics.service.js';

/** Analytics controller — all merchant-facing analytics endpoints. */
export const analyticsController = {
  // ─── Dashboard (legacy) ─────────────────────────────────────────

  async dashboard(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsService.dashboardStats(getStoreId(req)));
  },

  async dailyMetrics(req: Request, res: Response): Promise<void> {
    const { days } = req.query as unknown as { days: number };
    sendSuccess(res, await analyticsService.dailyMetrics(getStoreId(req), days));
  },

  async topProducts(req: Request, res: Response): Promise<void> {
    const { days, limit } = req.query as unknown as { days: number; limit: number };
    sendSuccess(res, await analyticsService.topProducts(getStoreId(req), days, limit));
  },

  // ─── Events ─────────────────────────────────────────────────────

  async trackEvent(req: Request, res: Response): Promise<void> {
    await analyticsService.track({ ...req.body, storeId: getStoreId(req) });
    sendSuccess(res, { tracked: true }, undefined, 202);
  },

  async trackEventsBatch(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const { events } = req.body as { events: Array<{ type: string; props?: Record<string, unknown>; customerId?: string; sessionId?: string }> };
    await analyticsService.trackMany(events.map((e) => ({ ...e, storeId })));
    sendSuccess(res, { tracked: events.length }, undefined, 202);
  },

  async listEvents(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);
    const [items, total] = await Promise.all([
      analyticsService.recentEvents(storeId, pageSize, (page - 1) * pageSize),
      analyticsService.countEvents(storeId, {
        type: q.type as string | undefined,
        customerId: q.customerId as string | undefined,
      }),
    ]);
    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async aggregateEvents(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as { type: string; aggregation: string; granularity: string; dateFrom?: string; dateTo?: string; property?: string };
    sendSuccess(res, await analyticsMetricService.aggregateEvents(
      storeId, q.type, q.aggregation, q.granularity, q.dateFrom, q.dateTo, q.property,
    ));
  },

  // ─── Metrics ────────────────────────────────────────────────────

  async getSalesMetrics(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as { dateFrom?: string; dateTo?: string };
    sendSuccess(res, await analyticsMetricService.calculateSalesMetrics(storeId, q.dateFrom, q.dateTo));
  },

  async getCustomerMetrics(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as { dateFrom?: string; dateTo?: string };
    sendSuccess(res, await analyticsMetricService.calculateCustomerMetrics(storeId, q.dateFrom, q.dateTo));
  },

  async getProductMetrics(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as { dateFrom?: string; dateTo?: string };
    sendSuccess(res, await analyticsMetricService.calculateProductMetrics(storeId, q.dateFrom, q.dateTo));
  },

  async getMessageMetrics(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as { dateFrom?: string; dateTo?: string };
    sendSuccess(res, await analyticsMetricService.calculateMessageMetrics(storeId, q.dateFrom, q.dateTo));
  },

  async getPaymentMetrics(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as { dateFrom?: string; dateTo?: string };
    sendSuccess(res, await analyticsMetricService.calculatePaymentMetrics(storeId, q.dateFrom, q.dateTo));
  },

  async getDeliveryMetrics(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as { dateFrom?: string; dateTo?: string };
    sendSuccess(res, await analyticsMetricService.calculateDeliveryMetrics(storeId, q.dateFrom, q.dateTo));
  },

  // ─── Reports ────────────────────────────────────────────────────

  async generateReport(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const { reportType, dateFrom, dateTo, format, parameters } = req.body;
    sendSuccess(res, await analyticsReportService.generate(storeId, reportType, dateFrom, dateTo, format, parameters), undefined, 201);
  },

  async scheduleReport(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const { reportType, frequency, format, parameters } = req.body;
    sendSuccess(res, await analyticsReportService.schedule(storeId, reportType, frequency, format, parameters), undefined, 201);
  },

  async getReportById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsReportService.getById(getStoreId(req), req.params.id));
  },

  async listReports(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);
    const [items, total] = await Promise.all([
      analyticsReportService.list(storeId, page, pageSize, {
        reportType: q.reportType as string | undefined,
        status: q.status as string | undefined,
        sortBy: q.sortBy as string | undefined,
        sortOrder: q.sortOrder as string | undefined,
      }),
      analyticsReportService.count(storeId, {
        reportType: q.reportType as string | undefined,
        status: q.status as string | undefined,
      }),
    ]);
    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async cancelScheduledReport(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsReportService.cancelScheduled(getStoreId(req), req.params.id));
  },

  // ─── Dashboards ─────────────────────────────────────────────────

  async createDashboard(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsDashboardService.create(getStoreId(req), req.body), undefined, 201);
  },

  async getDashboardById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsDashboardService.getById(getStoreId(req), req.params.id));
  },

  async getDefaultDashboard(req: Request, res: Response): Promise<void> {
    const dashboard = await analyticsDashboardService.getDefault(getStoreId(req));
    sendSuccess(res, dashboard ?? { message: 'No default dashboard' });
  },

  async listDashboards(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsDashboardService.list(getStoreId(req)));
  },

  async updateDashboard(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsDashboardService.update(getStoreId(req), req.params.id, req.body));
  },

  async deleteDashboard(req: Request, res: Response): Promise<void> {
    await analyticsDashboardService.remove(getStoreId(req), req.params.id);
    sendSuccess(res, { deleted: true });
  },

  async addWidget(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsDashboardService.addWidget(getStoreId(req), req.params.id, req.body), undefined, 201);
  },

  async updateWidget(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsDashboardService.updateWidget(getStoreId(req), req.params.id, req.params.widgetId, req.body));
  },

  async deleteWidget(req: Request, res: Response): Promise<void> {
    await analyticsDashboardService.removeWidget(getStoreId(req), req.params.id, req.params.widgetId);
    sendSuccess(res, { deleted: true });
  },

  async getDashboardWidgets(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsDashboardService.getWidgets(getStoreId(req), req.params.id));
  },

  // ─── Insights ───────────────────────────────────────────────────

  async generateInsights(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const { dateFrom, dateTo, types } = req.body as { dateFrom?: string; dateTo?: string; types?: string[] };
    const insights = await analyticsInsightService.generate(storeId, { dateFrom, dateTo, types });
    sendSuccess(res, { insights, count: insights.length }, undefined, 201);
  },

  async listInsights(req: Request, res: Response): Promise<void> {
    const storeId = getStoreId(req);
    const q = req.query as Record<string, unknown>;
    const page = Number(q.page) || 1;
    const pageSize = Math.min(Number(q.pageSize) || 20, 100);
    const [items, total] = await Promise.all([
      analyticsInsightService.list(storeId, page, pageSize, {
        insightType: q.insightType as string | undefined,
        severity: q.severity as string | undefined,
        status: q.status as string | undefined,
        sortBy: q.sortBy as string | undefined,
        sortOrder: q.sortOrder as string | undefined,
      }),
      analyticsInsightService.count(storeId, {
        insightType: q.insightType as string | undefined,
        severity: q.severity as string | undefined,
        status: q.status as string | undefined,
      }),
    ]);
    sendSuccess(res, items, { pagination: paginationMeta(page, pageSize, total) });
  },

  async getInsightById(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsInsightService.getById(getStoreId(req), req.params.id));
  },

  async dismissInsight(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await analyticsInsightService.dismiss(getStoreId(req), req.params.id));
  },

  async actOnInsight(req: Request, res: Response): Promise<void> {
    const { action } = req.body as { action: string };
    sendSuccess(res, await analyticsInsightService.act(getStoreId(req), req.params.id, action));
  },
} as const;
