import { z } from 'zod';

/** Analytics DTOs — comprehensive validation for all analytics endpoints. */

const sortOrder = z.enum(['asc', 'desc']).default('desc');
const dateStr = z.coerce.string().datetime().optional();

// ─── Events ───────────────────────────────────────────────────────

export const trackEventSchema = z.object({
  type: z.string().min(3).max(64).regex(/^[a-z][a-z0-9._-]*$/),
  props: z
    .record(z.unknown())
    .default({})
    .refine((p) => Object.keys(p).length <= 50, 'Too many event properties (max 50)'),
  customerId: z.string().max(64).optional(),
  sessionId: z.string().max(128).optional(),
  timestamp: z.coerce.string().datetime().optional(),
});
export type TrackEventDto = z.infer<typeof trackEventSchema>;

export const trackEventsBatchSchema = z.object({
  events: z.array(trackEventSchema).min(1).max(100),
});
export type TrackEventsBatchDto = z.infer<typeof trackEventsBatchSchema>;

export const listEventsQuerySchema = z.object({
  type: z.string().max(64).optional(),
  customerId: z.string().max(64).optional(),
  sessionId: z.string().max(128).optional(),
  dateFrom: dateStr,
  dateTo: dateStr,
  sortBy: z.enum(['occurredAt', 'type']).default('occurredAt'),
  sortOrder,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListEventsQueryDto = z.infer<typeof listEventsQuerySchema>;

export const aggregateEventsQuerySchema = z.object({
  type: z.string().min(3).max(64),
  aggregation: z.enum(['count', 'sum', 'avg', 'min', 'max']).default('count'),
  property: z.string().max(64).optional(),
  granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']).default('daily'),
  dateFrom: dateStr,
  dateTo: dateStr,
});
export type AggregateEventsQueryDto = z.infer<typeof aggregateEventsQuerySchema>;

// ─── Metrics ──────────────────────────────────────────────────────

export const metricsQuerySchema = z.object({
  dateFrom: dateStr,
  dateTo: dateStr,
  granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']).default('daily'),
});
export type MetricsQueryDto = z.infer<typeof metricsQuerySchema>;

export const topProductsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sortBy: z.enum(['revenue', 'quantity', 'orders']).default('quantity'),
});

export const dailyMetricsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const customerMetricsQuerySchema = z.object({
  dateFrom: dateStr,
  dateTo: dateStr,
  segmentBy: z.enum(['source', 'cohort', 'ltv']).optional(),
});

export const productMetricsQuerySchema = z.object({
  dateFrom: dateStr,
  dateTo: dateStr,
  productId: z.string().optional(),
  categoryId: z.string().optional(),
});

export const messageMetricsQuerySchema = z.object({
  dateFrom: dateStr,
  dateTo: dateStr,
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

export const paymentMetricsQuerySchema = z.object({
  dateFrom: dateStr,
  dateTo: dateStr,
  provider: z.enum(['PAYSTACK', 'FLUTTERWAVE', 'OPAY']).optional(),
});

export const deliveryMetricsQuerySchema = z.object({
  dateFrom: dateStr,
  dateTo: dateStr,
  carrier: z.enum(['GIG', 'KWIK', 'SENDY', 'MANUAL']).optional(),
});

export const exportMetricsSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  dateFrom: dateStr,
  dateTo: dateStr,
  metrics: z.array(z.string()).min(1).max(20),
});

// ─── Reports ──────────────────────────────────────────────────────

export const reportIdParams = z.object({ id: z.string().min(1) });

export const generateReportSchema = z.object({
  reportType: z.enum([
    'SALES', 'CUSTOMERS', 'PRODUCTS', 'MESSAGES', 'PAYMENTS', 'DELIVERIES', 'COMPREHENSIVE',
  ]),
  dateFrom: z.coerce.string().datetime(),
  dateTo: z.coerce.string().datetime(),
  format: z.enum(['CSV', 'JSON', 'PDF']).default('JSON'),
  parameters: z.record(z.unknown()).default({}),
});

export const scheduleReportSchema = z.object({
  reportType: z.enum([
    'SALES', 'CUSTOMERS', 'PRODUCTS', 'MESSAGES', 'PAYMENTS', 'DELIVERIES', 'COMPREHENSIVE',
  ]),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  format: z.enum(['CSV', 'JSON', 'PDF']).default('JSON'),
  parameters: z.record(z.unknown()).default({}),
});

export const listReportsQuerySchema = z.object({
  reportType: z.enum([
    'SALES', 'CUSTOMERS', 'PRODUCTS', 'MESSAGES', 'PAYMENTS', 'DELIVERIES', 'COMPREHENSIVE',
  ]).optional(),
  status: z.enum(['PENDING', 'GENERATING', 'COMPLETED', 'FAILED']).optional(),
  sortBy: z.enum(['createdAt', 'generatedAt', 'reportType']).default('createdAt'),
  sortOrder,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Dashboards ───────────────────────────────────────────────────

export const dashboardIdParams = z.object({ id: z.string().min(1) });

export const createDashboardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().default(false),
  layout: z.record(z.unknown()).default({}),
  widgets: z.array(z.object({
    widgetType: z.string().min(1).max(64),
    title: z.string().min(1).max(100),
    config: z.record(z.unknown()).default({}),
    position: z.record(z.unknown()).default({}),
    refreshSecs: z.number().int().min(30).max(3600).default(300),
  })).max(20).optional(),
});

export const updateDashboardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  layout: z.record(z.unknown()).optional(),
});

export const addWidgetSchema = z.object({
  widgetType: z.string().min(1).max(64),
  title: z.string().min(1).max(100),
  config: z.record(z.unknown()).default({}),
  position: z.record(z.unknown()).default({}),
  refreshSecs: z.number().int().min(30).max(3600).default(300),
});

export const updateWidgetSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  position: z.record(z.unknown()).optional(),
  refreshSecs: z.number().int().min(30).max(3600).optional(),
});

// ─── Insights ─────────────────────────────────────────────────────

export const insightIdParams = z.object({ id: z.string().min(1) });

export const generateInsightsSchema = z.object({
  dateFrom: z.coerce.string().datetime().optional(),
  dateTo: z.coerce.string().datetime().optional(),
  types: z.array(z.enum(['TREND', 'ANOMALY', 'OPPORTUNITY', 'RISK', 'RECOMMENDATION'])).optional(),
});

export const listInsightsQuerySchema = z.object({
  insightType: z.enum(['TREND', 'ANOMALY', 'OPPORTUNITY', 'RISK', 'RECOMMENDATION']).optional(),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['ACTIVE', 'DISMISSED', 'ACTED_UPON', 'EXPIRED']).default('ACTIVE'),
  sortBy: z.enum(['createdAt', 'severity', 'insightType']).default('createdAt'),
  sortOrder,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const actOnInsightSchema = z.object({
  action: z.string().min(1).max(128),
  note: z.string().max(500).optional(),
});
