import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api/client';

/** Dashboard analytics — 60s server-side cache, safe to poll. */
export interface AnalyticsSummary {
  today: { revenue: number; orders: number; newCustomers: number; messages: number };
  vsYesterday: { revenueDeltaPct: number | null; ordersDeltaPct: number | null };
  week: { revenue: number; orders: number; aiResolutionRate: number };
  timeseries: Array<{ date: string; revenue: number; orders: number }>;
}

export function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => api<AnalyticsSummary>('/analytics/summary'),
    refetchInterval: 60_000,
  });
}

export function useTopProducts(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'top-products', days],
    queryFn: () =>
      api<Array<{ productId: string; name: string; unitsSold: number; revenue: number }>>(
        '/analytics/top-products',
        { params: { days } },
      ),
  });
}

export function useFunnel(days = 30) {
  return useQuery({
    queryKey: ['analytics', 'funnel', days],
    queryFn: () =>
      api<{
        conversations: number;
        ordersCreated: number;
        ordersPaid: number;
        chatToOrderRate: number;
        checkoutCompletion: number;
      }>('/analytics/funnel', { params: { days } }),
  });
}
