export { AnalyticsEventBus } from './events/analytics-event-bus';
export { MetricsProcessor } from './processors/metrics-processor';

/** Canonical metric names surfaced in dashboards & the metrics API. */
export const METRIC_KEYS = [
  'revenue_today',
  'orders_today',
  'new_customers_today',
  'conversations_open',
  'ai_resolution_rate',
  'avg_response_seconds',
  'conversion_rate',
  'top_products',
  'revenue_by_day_30d',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];
