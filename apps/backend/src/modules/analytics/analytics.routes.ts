import { Router } from 'express';

import { authenticate, tenantScope } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { analyticsController } from './analytics.controller.js';
import {
  trackEventSchema,
  trackEventsBatchSchema,
  listEventsQuerySchema,
  aggregateEventsQuerySchema,
  metricsQuerySchema,
  topProductsQuerySchema,
  dailyMetricsQuerySchema,
  generateReportSchema,
  scheduleReportSchema,
  listReportsQuerySchema,
  reportIdParams,
  createDashboardSchema,
  updateDashboardSchema,
  dashboardIdParams,
  addWidgetSchema,
  updateWidgetSchema,
  generateInsightsSchema,
  listInsightsQuerySchema,
  insightIdParams,
  actOnInsightSchema,
} from './analytics.dto.js';

/** Analytics routes — event capture, metrics, reports, dashboards, insights. */
export const analyticsRouter: Router = Router();
analyticsRouter.use(authenticate(), tenantScope());

// ─── Dashboard (legacy quick stats) ──────────────────────────────

analyticsRouter.get('/dashboard', asyncHandler(analyticsController.dashboard));

analyticsRouter.get(
  '/metrics/daily',
  validate({ query: dailyMetricsQuerySchema }),
  asyncHandler(analyticsController.dailyMetrics),
);

analyticsRouter.get(
  '/products/top',
  validate({ query: topProductsQuerySchema }),
  asyncHandler(analyticsController.topProducts),
);

// ─── Events ──────────────────────────────────────────────────────

analyticsRouter.post(
  '/events',
  requirePermission('store:read'),
  validate({ body: trackEventSchema }),
  asyncHandler(analyticsController.trackEvent),
);

analyticsRouter.post(
  '/events/batch',
  requirePermission('store:read'),
  validate({ body: trackEventsBatchSchema }),
  asyncHandler(analyticsController.trackEventsBatch),
);

analyticsRouter.get(
  '/events',
  validate({ query: listEventsQuerySchema }),
  asyncHandler(analyticsController.listEvents),
);

analyticsRouter.get(
  '/events/aggregate',
  validate({ query: aggregateEventsQuerySchema }),
  asyncHandler(analyticsController.aggregateEvents),
);

// ─── Metrics ─────────────────────────────────────────────────────

analyticsRouter.get(
  '/metrics/sales',
  validate({ query: metricsQuerySchema }),
  asyncHandler(analyticsController.getSalesMetrics),
);

analyticsRouter.get(
  '/metrics/customers',
  validate({ query: metricsQuerySchema }),
  asyncHandler(analyticsController.getCustomerMetrics),
);

analyticsRouter.get(
  '/metrics/products',
  validate({ query: metricsQuerySchema }),
  asyncHandler(analyticsController.getProductMetrics),
);

analyticsRouter.get(
  '/metrics/messages',
  validate({ query: metricsQuerySchema }),
  asyncHandler(analyticsController.getMessageMetrics),
);

analyticsRouter.get(
  '/metrics/payments',
  validate({ query: metricsQuerySchema }),
  asyncHandler(analyticsController.getPaymentMetrics),
);

analyticsRouter.get(
  '/metrics/deliveries',
  validate({ query: metricsQuerySchema }),
  asyncHandler(analyticsController.getDeliveryMetrics),
);

// ─── Reports ─────────────────────────────────────────────────────

analyticsRouter.get(
  '/reports',
  validate({ query: listReportsQuerySchema }),
  asyncHandler(analyticsController.listReports),
);

analyticsRouter.post(
  '/reports/generate',
  requirePermission('store:read'),
  validate({ body: generateReportSchema }),
  asyncHandler(analyticsController.generateReport),
);

analyticsRouter.post(
  '/reports/schedule',
  requirePermission('store:read'),
  validate({ body: scheduleReportSchema }),
  asyncHandler(analyticsController.scheduleReport),
);

analyticsRouter.get(
  '/reports/:id',
  validate({ params: reportIdParams }),
  asyncHandler(analyticsController.getReportById),
);

analyticsRouter.delete(
  '/reports/:id/schedule',
  requirePermission('store:read'),
  validate({ params: reportIdParams }),
  asyncHandler(analyticsController.cancelScheduledReport),
);

// ─── Dashboards ──────────────────────────────────────────────────

analyticsRouter.get('/dashboards/default', asyncHandler(analyticsController.getDefaultDashboard));

analyticsRouter.get('/dashboards', asyncHandler(analyticsController.listDashboards));

analyticsRouter.post(
  '/dashboards',
  requirePermission('store:read'),
  validate({ body: createDashboardSchema }),
  asyncHandler(analyticsController.createDashboard),
);

analyticsRouter.get(
  '/dashboards/:id',
  validate({ params: dashboardIdParams }),
  asyncHandler(analyticsController.getDashboardById),
);

analyticsRouter.put(
  '/dashboards/:id',
  requirePermission('store:read'),
  validate({ params: dashboardIdParams, body: updateDashboardSchema }),
  asyncHandler(analyticsController.updateDashboard),
);

analyticsRouter.delete(
  '/dashboards/:id',
  requirePermission('store:read'),
  validate({ params: dashboardIdParams }),
  asyncHandler(analyticsController.deleteDashboard),
);

analyticsRouter.get(
  '/dashboards/:id/widgets',
  validate({ params: dashboardIdParams }),
  asyncHandler(analyticsController.getDashboardWidgets),
);

analyticsRouter.post(
  '/dashboards/:id/widgets',
  requirePermission('store:read'),
  validate({ params: dashboardIdParams, body: addWidgetSchema }),
  asyncHandler(analyticsController.addWidget),
);

analyticsRouter.put(
  '/dashboards/:id/widgets/:widgetId',
  requirePermission('store:read'),
  validate({ params: dashboardIdParams, body: updateWidgetSchema }),
  asyncHandler(analyticsController.updateWidget),
);

analyticsRouter.delete(
  '/dashboards/:id/widgets/:widgetId',
  requirePermission('store:read'),
  validate({ params: dashboardIdParams }),
  asyncHandler(analyticsController.deleteWidget),
);

// ─── Insights ────────────────────────────────────────────────────

analyticsRouter.post(
  '/insights/generate',
  requirePermission('store:read'),
  validate({ body: generateInsightsSchema }),
  asyncHandler(analyticsController.generateInsights),
);

analyticsRouter.get(
  '/insights',
  validate({ query: listInsightsQuerySchema }),
  asyncHandler(analyticsController.listInsights),
);

analyticsRouter.get(
  '/insights/:id',
  validate({ params: insightIdParams }),
  asyncHandler(analyticsController.getInsightById),
);

analyticsRouter.post(
  '/insights/:id/dismiss',
  requirePermission('store:read'),
  validate({ params: insightIdParams }),
  asyncHandler(analyticsController.dismissInsight),
);

analyticsRouter.post(
  '/insights/:id/act',
  requirePermission('store:read'),
  validate({ params: insightIdParams, body: actOnInsightSchema }),
  asyncHandler(analyticsController.actOnInsight),
);
