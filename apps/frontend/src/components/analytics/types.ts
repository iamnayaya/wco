import type { PaginationMeta } from '../../lib/api/client';

/**
 * Analytics wire models — mirror the analytics metrics module
 * (`/api/v1/analytics/metrics/*`, `/reports`, `/insights`).
 *
 * `dailySeries` values come from raw SQL and arrive over the wire as ISO
 * date strings (e.g. `"2026-08-27T00:00:00.000Z"`). Convert with
 * `dateKey()`/`formatAxis` before charting.
 */

export type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

export type MetricRange = {
  from?: string;
  to?: string;
  granularity?: Granularity;
};

// ─── Sales ────────────────────────────────────────────────────────

export interface DailyPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface SalesMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueGrowth: number;
  orderGrowth: number;
  dailySeries: DailyPoint[];
  currency: string;
}

// ─── Customers ───────────────────────────────────────────────────

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number;
  acquisitionGrowth: number;
  averageLifetimeValue: number;
  averageOrdersPerCustomer: number;
}

// ─── Products ────────────────────────────────────────────────────

export interface ProductPerformance {
  productId: string;
  quantitySold: number;
  revenue: number;
  orderCount: number;
}

export interface ProductMetrics {
  totalProducts: number;
  topSelling: ProductPerformance[];
  lowPerformers: ProductPerformance[];
  inventoryTurnover: number;
  stockByStatus: Array<{ status: string; _count: number }>;
  categoryBreakdown: Array<{ category: string | null; products: number; revenue: number }>;
}

export interface TopProductRow {
  productId: string;
  quantitySold: number;
  revenue: number;
  orderCount: number;
}

// ─── Messages ────────────────────────────────────────────────────

export interface MessageDailyPoint {
  date: string;
  total: number;
  ai: number;
  escalated: number;
}

export interface MessageMetrics {
  totalConversations: number;
  aiResolved: number;
  escalated: number;
  aiResolutionRate: number;
  escalationRate: number;
  avgResponseSeconds: number;
  dailySeries: MessageDailyPoint[];
}

// ─── Payments ────────────────────────────────────────────────────

export interface ProviderStat {
  provider: string;
  count: number;
  totalAmount: number;
}

export interface MethodStat {
  type: string;
  count: number;
}

export interface PaymentDailyPoint {
  date: string;
  total: number;
  succeeded: number;
  amount: number;
}

export interface PaymentMetrics {
  totalPayments: number;
  succeeded: number;
  failed: number;
  successRate: number;
  byProvider: ProviderStat[];
  byMethod: MethodStat[];
  refunds: { count: number; totalAmount: number };
  dailySeries: PaymentDailyPoint[];
}

// ─── Deliveries ──────────────────────────────────────────────────

export interface CarrierStat {
  carrier: string;
  count: number;
  avgEtaMinutes: number;
  avgRating: number;
}

export interface DeliveryDailyPoint {
  date: string;
  total: number;
  delivered: number;
  failed: number;
}

export interface DeliveryMetrics {
  totalDeliveries: number;
  delivered: number;
  failed: number;
  successRate: number;
  averageFee: number;
  averageRating: number;
  totalClaims: number;
  byCarrier: CarrierStat[];
  dailySeries: DeliveryDailyPoint[];
}

// ─── Reports ─────────────────────────────────────────────────────

export type ReportType =
  | 'SALES'
  | 'CUSTOMERS'
  | 'PRODUCTS'
  | 'MESSAGES'
  | 'PAYMENTS'
  | 'DELIVERIES'
  | 'COMPREHENSIVE';

export type ReportStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
export type ReportFormat = 'CSV' | 'JSON' | 'PDF';
export type ReportFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ONCE';

export interface AnalyticsReport {
  id: string;
  storeId: string;
  reportType: ReportType;
  status: ReportStatus;
  format: ReportFormat;
  frequency: ReportFrequency;
  dateFrom: string;
  dateTo: string;
  parameters: Record<string, unknown>;
  result: Record<string, unknown> | null;
  fileUrl: string | null;
  error: string | null;
  scheduledAt: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListReportsParams {
  reportType?: ReportType;
  status?: ReportStatus;
  page?: number;
  pageSize?: number;
}

export interface ReportsListResult {
  items: AnalyticsReport[];
  meta: PaginationMeta;
}

// ─── Insights ────────────────────────────────────────────────────

export type InsightType = 'TREND' | 'ANOMALY' | 'OPPORTUNITY' | 'RISK' | 'RECOMMENDATION';
export type InsightSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type InsightStatus = 'ACTIVE' | 'DISMISSED' | 'ACTED_UPON' | 'EXPIRED';

export interface AnalyticsInsight {
  id: string;
  storeId: string;
  insightType: InsightType;
  severity: InsightSeverity;
  status: InsightStatus;
  title: string;
  body: string;
  data: Record<string, unknown>;
  actionUrl: string | null;
  actionLabel: string | null;
  expiresAt: string | null;
  dismissedAt: string | null;
  actedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListInsightsParams {
  insightType?: InsightType;
  severity?: InsightSeverity;
  status?: InsightStatus;
  page?: number;
  pageSize?: number;
}

export interface InsightsListResult {
  items: AnalyticsInsight[];
  meta: PaginationMeta;
}
