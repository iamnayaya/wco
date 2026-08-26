import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api/client';

export interface DashboardMetrics {
  today: {
    revenue: number;
    orders: number;
    newCustomers: number;
    messages: number;
    unreadMessages: number;
  };
  week: {
    revenue: number;
    orders: number;
    customers: number;
    messages: number;
    aiResolutionRate: number;
  };
  month: {
    revenue: number;
    orders: number;
    customers: number;
    growth: number;
  };
  vsYesterday: {
    revenueDeltaPct: number | null;
    ordersDeltaPct: number | null;
    customersDeltaPct: number | null;
  };
  timeseries: Array<{ date: string; revenue: number; orders: number }>;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
}

export interface TopProduct {
  id: string;
  name: string;
  unitsSold: number;
  revenue: number;
  stock: number;
  image?: string;
}

export interface RecentMessage {
  id: string;
  customerName: string;
  preview: string;
  time: string;
  unread: boolean;
  avatar?: string;
}

export interface DashboardTask {
  id: string;
  title: string;
  type: 'pending_order' | 'low_stock' | 'payment_overdue' | 'delivery_pending';
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  link: string;
}

export interface AIInsight {
  id: string;
  title: string;
  description: string;
  action: string;
  link: string;
  type: 'opportunity' | 'warning' | 'info';
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => api<DashboardMetrics>('/analytics/summary'),
    refetchInterval: 60_000,
  });
}

export function useDashboardOrders() {
  return useQuery({
    queryKey: ['dashboard', 'recent-orders'],
    queryFn: () => api<{ items: RecentOrder[] }>('/orders', { params: { limit: 5 } }),
  });
}

export function useDashboardProducts() {
  return useQuery({
    queryKey: ['dashboard', 'top-products'],
    queryFn: () => api<TopProduct[]>('/analytics/top-products', { params: { days: 30 } }),
  });
}

export function useDashboardMessages() {
  return useQuery({
    queryKey: ['dashboard', 'recent-messages'],
    queryFn: () => api<RecentMessage[]>('/messages', { params: { limit: 5 } }),
  });
}

export function useDashboardTasks() {
  return useQuery({
    queryKey: ['dashboard', 'tasks'],
    queryFn: () => api<DashboardTask[]>('/dashboard/tasks'),
  });
}

export function useDashboardInsights() {
  return useQuery({
    queryKey: ['dashboard', 'insights'],
    queryFn: () => api<AIInsight[]>('/ai/insights'),
  });
}
