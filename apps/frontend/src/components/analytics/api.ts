import {
  api,
  type ApiEnvelope,
  type PaginationMeta,
} from '../../lib/api/client';
import type {
  AnalyticsInsight,
  AnalyticsReport,
  CustomerMetrics,
  DeliveryMetrics,
  InsightsListResult,
  InsightSeverity,
  InsightStatus,
  InsightType,
  ListInsightsParams,
  ListReportsParams,
  MessageMetrics,
  MetricRange,
  PaymentMetrics,
  ProductMetrics,
  ReportFormat,
  ReportFrequency,
  ReportType,
  ReportsListResult,
  SalesMetrics,
  TopProductRow,
} from './types';

/**
 * Typed Analytics API surface — merchant-facing analytics.
 *
 * All metric reads hit the metrics module offset-time-series endpoints and
 * unwrap the `{success, data, meta}` envelope. Reports + insights are
 * created/generated on the backend; this client also emits exports.
 */

function rangeParams(range: MetricRange, extra: Record<string, string | number | undefined> = {}): Record<string, string | number | undefined> {
  return {
    ...extra,
    dateFrom: range.from || undefined,
    dateTo: range.to || undefined,
    granularity: range.granularity || undefined,
  };
}

// ─── Metrics ─────────────────────────────────────────────────────

export async function getSalesMetrics(range: MetricRange = {}): Promise<SalesMetrics> {
  const envelope = await api<ApiEnvelope<SalesMetrics>>('/analytics/metrics/sales', {
    params: rangeParams(range),
  });
  return envelope.data;
}

export async function getCustomerMetrics(range: MetricRange = {}): Promise<CustomerMetrics> {
  const envelope = await api<ApiEnvelope<CustomerMetrics>>('/analytics/metrics/customers', {
    params: rangeParams(range),
  });
  return envelope.data;
}

export async function getProductMetrics(range: MetricRange = {}): Promise<ProductMetrics> {
  const envelope = await api<ApiEnvelope<ProductMetrics>>('/analytics/metrics/products', {
    params: rangeParams(range),
  });
  return envelope.data;
}

export async function getMessageMetrics(range: MetricRange = {}): Promise<MessageMetrics> {
  const envelope = await api<ApiEnvelope<MessageMetrics>>('/analytics/metrics/messages', {
    params: rangeParams(range),
  });
  return envelope.data;
}

export async function getPaymentMetrics(range: MetricRange = {}): Promise<PaymentMetrics> {
  const envelope = await api<ApiEnvelope<PaymentMetrics>>('/analytics/metrics/payments', {
    params: rangeParams(range),
  });
  return envelope.data;
}

export async function getDeliveryMetrics(range: MetricRange = {}): Promise<DeliveryMetrics> {
  const envelope = await api<ApiEnvelope<DeliveryMetrics>>('/analytics/metrics/deliveries', {
    params: rangeParams(range),
  });
  return envelope.data;
}

/** Legacy top-products helper (used by overview). */
export async function getTopProducts(params: { days?: number; limit?: number; sortBy?: string } = {}): Promise<TopProductRow[]> {
  const envelope = await api<ApiEnvelope<TopProductRow[]>>('/analytics/products/top', {
    params: {
      days: params.days ?? 30,
      limit: params.limit ?? 10,
      sortBy: params.sortBy ?? 'quantity',
    },
  });
  return envelope.data;
}

// ─── Reports ─────────────────────────────────────────────────────

function metaFrom<T>(envelope: ApiEnvelope<T[], { pagination?: PaginationMeta }>, fallbackPage: number, fallbackSize: number): PaginationMeta {
  return envelope.meta?.pagination ?? {
    page: fallbackPage,
    pageSize: fallbackSize,
    totalItems: envelope.data.length,
    totalPages: 1,
  };
}

export async function listReports(params: ListReportsParams = {}): Promise<ReportsListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const envelope = await api<ApiEnvelope<AnalyticsReport[], { pagination?: PaginationMeta }>>('/analytics/reports', {
    params: {
      page,
      pageSize,
      reportType: params.reportType || undefined,
      status: params.status || undefined,
    },
  });
  return { items: envelope.data, meta: metaFrom(envelope, page, pageSize) };
}

export interface GenerateReportInput {
  reportType: ReportType;
  dateFrom: string;
  dateTo: string;
  format?: ReportFormat;
}

export async function generateReport(input: GenerateReportInput): Promise<AnalyticsReport> {
  const envelope = await api<ApiEnvelope<AnalyticsReport>>('/analytics/reports/generate', {
    method: 'POST',
    body: { ...input, format: input.format ?? 'CSV' },
  });
  return envelope.data;
}

export interface ScheduleReportInput {
  reportType: ReportType;
  frequency: ReportFrequency;
  format?: ReportFormat;
}

export async function scheduleReport(input: ScheduleReportInput): Promise<AnalyticsReport> {
  const envelope = await api<ApiEnvelope<AnalyticsReport>>('/analytics/reports/schedule', {
    method: 'POST',
    body: { ...input, format: input.format ?? 'CSV' },
    idempotencyKey: crypto.randomUUID(),
  });
  return envelope.data;
}

export async function cancelScheduledReport(id: string): Promise<AnalyticsReport> {
  const envelope = await api<ApiEnvelope<AnalyticsReport>>(`/analytics/reports/${id}/schedule`, {
    method: 'DELETE',
  });
  return envelope.data;
}

/**
 * Client-side export of a report's `result` to CSV (BOM included for Excel).
 * The backend also exposes exports; this is a lightweight browser-only path.
 */
export function exportMetricsCsv(result: Record<string, unknown>, filename = 'analytics.csv'): void {
  const lines = serializeJsonToCsv(result);
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function serializeJsonToCsv(obj: Record<string, unknown>): string[] {
  const rows: string[] = [];
  const flatten = (prefix: string, value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach((item, idx) => flatten(`${prefix}${idx + 1}`, item));
      return;
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => flatten(prefix ? `${prefix}.${k}` : k, v));
      return;
    }
    const cell = (value === null || value === undefined) ? '' : String(value);
    rows.push(`${csvEscape(prefix)},${csvEscape(cell)}`);
  };
  Object.entries(obj).forEach(([k, v]) => flatten(k, v));
  return rows.length ? rows : ['key,value'];
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

// ─── Insights ────────────────────────────────────────────────────

export async function generateInsights(input: { dateFrom?: string; dateTo?: string; types?: InsightType[] } = {}): Promise<AnalyticsInsight[]> {
  const envelope = await api<ApiEnvelope<{ insights: AnalyticsInsight[]; count: number }>>('/analytics/insights/generate', {
    method: 'POST',
    body: input,
  });
  return envelope.data.insights;
}

export async function listInsights(params: ListInsightsParams = {}): Promise<InsightsListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const envelope = await api<ApiEnvelope<AnalyticsInsight[], { pagination?: PaginationMeta }>>('/analytics/insights', {
    params: {
      page,
      pageSize,
      insightType: params.insightType || undefined,
      severity: params.severity || undefined,
      status: params.status || undefined,
    },
  });
  return { items: envelope.data, meta: metaFrom(envelope, page, pageSize) };
}

export async function dismissInsight(id: string): Promise<AnalyticsInsight> {
  const envelope = await api<ApiEnvelope<AnalyticsInsight>>(`/analytics/insights/${id}/dismiss`, {
    method: 'POST',
  });
  return envelope.data;
}

export async function actOnInsight(id: string, action: string): Promise<AnalyticsInsight> {
  const envelope = await api<ApiEnvelope<AnalyticsInsight>>(`/analytics/insights/${id}/act`, {
    method: 'POST',
    body: { action },
  });
  return envelope.data;
}
