'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as analyticsApi from './api';
import type { GenerateReportInput, ScheduleReportInput } from './api';
import type { InsightType, ListInsightsParams, ListReportsParams, MetricRange } from './types';

const ANALYTICS_KEYS = {
  sales: (range: MetricRange) => ['analytics', 'sales', range] as const,
  customers: (range: MetricRange) => ['analytics', 'customers', range] as const,
  products: (range: MetricRange) => ['analytics', 'products', range] as const,
  messages: (range: MetricRange) => ['analytics', 'messages', range] as const,
  payments: (range: MetricRange) => ['analytics', 'payments', range] as const,
  deliveries: (range: MetricRange) => ['analytics', 'deliveries', range] as const,
  topProducts: (params: { days: number }) => ['analytics', 'top-products', params] as const,
  reports: (params: ListReportsParams) => ['analytics', 'reports', params] as const,
  insights: (params: ListInsightsParams) => ['analytics', 'insights', params] as const,
};

const REFRESH_MS = 60_000;

export function useSalesMetrics(range: MetricRange) {
  return useQuery({
    queryKey: ANALYTICS_KEYS.sales(range),
    queryFn: () => analyticsApi.getSalesMetrics(range),
    placeholderData: (prev) => prev,
    refetchInterval: REFRESH_MS,
  });
}

export function useCustomerMetrics(range: MetricRange) {
  return useQuery({
    queryKey: ANALYTICS_KEYS.customers(range),
    queryFn: () => analyticsApi.getCustomerMetrics(range),
    placeholderData: (prev) => prev,
    refetchInterval: REFRESH_MS,
  });
}

export function useProductMetrics(range: MetricRange) {
  return useQuery({
    queryKey: ANALYTICS_KEYS.products(range),
    queryFn: () => analyticsApi.getProductMetrics(range),
    placeholderData: (prev) => prev,
    refetchInterval: REFRESH_MS,
  });
}

export function useMessageMetrics(range: MetricRange) {
  return useQuery({
    queryKey: ANALYTICS_KEYS.messages(range),
    queryFn: () => analyticsApi.getMessageMetrics(range),
    placeholderData: (prev) => prev,
    refetchInterval: REFRESH_MS,
  });
}

export function usePaymentMetrics(range: MetricRange) {
  return useQuery({
    queryKey: ANALYTICS_KEYS.payments(range),
    queryFn: () => analyticsApi.getPaymentMetrics(range),
    placeholderData: (prev) => prev,
    refetchInterval: REFRESH_MS,
  });
}

export function useDeliveryMetrics(range: MetricRange) {
  return useQuery({
    queryKey: ANALYTICS_KEYS.deliveries(range),
    queryFn: () => analyticsApi.getDeliveryMetrics(range),
    placeholderData: (prev) => prev,
    refetchInterval: REFRESH_MS,
  });
}

export function useTopProducts(days = 30, limit = 10) {
  return useQuery({
    queryKey: ANALYTICS_KEYS.topProducts({ days }),
    queryFn: () => analyticsApi.getTopProducts({ days, limit }),
    placeholderData: (prev) => prev,
  });
}

// ─── Reports ─────────────────────────────────────────────────────

export function useReportsList(params: ListReportsParams = {}) {
  return useQuery({
    queryKey: ANALYTICS_KEYS.reports(params),
    queryFn: () => analyticsApi.listReports(params),
    placeholderData: (prev) => prev,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateReportInput) => analyticsApi.generateReport(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'reports'] });
    },
  });
}

export function useScheduleReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleReportInput) => analyticsApi.scheduleReport(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'reports'] });
    },
  });
}

export function useCancelScheduledReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => analyticsApi.cancelScheduledReport(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'reports'] });
    },
  });
}

// ─── Insights ────────────────────────────────────────────────────

export function useInsights(params: ListInsightsParams = {}) {
  return useQuery({
    queryKey: ANALYTICS_KEYS.insights(params),
    queryFn: () => analyticsApi.listInsights(params),
    placeholderData: (prev) => prev,
    refetchInterval: REFRESH_MS,
  });
}

export function useGenerateInsights() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { dateFrom?: string; dateTo?: string; types?: InsightType[] }) =>
      analyticsApi.generateInsights(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'insights'] });
    },
  });
}

export function useDismissInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => analyticsApi.dismissInsight(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'insights'] });
    },
  });
}

export function useActOnInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => analyticsApi.actOnInsight(id, action),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'insights'] });
    },
  });
}

export const analyticsKeys = ANALYTICS_KEYS;
