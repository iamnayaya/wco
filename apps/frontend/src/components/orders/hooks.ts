'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as orderApi from './api';
import type { CreateOrderInput, UpdateOrderInput } from './api';
import type { ListOrdersParams, OrderStatus } from './types';

const ORDER_KEYS = {
  all: ['orders'] as const,
  list: (params: ListOrdersParams) => ['orders', 'list', params] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
  items: (id: string) => ['orders', 'items', id] as const,
  notes: (id: string) => ['orders', 'notes', id] as const,
  timeline: (id: string) => ['orders', 'timeline', id] as const,
  stats: ['orders', 'stats'] as const,
  refunds: (id: string) => ['orders', 'refunds', id] as const,
};

export function useOrdersList(params: ListOrdersParams) {
  return useQuery({
    queryKey: ORDER_KEYS.list(params),
    queryFn: () => orderApi.listOrders(params),
    placeholderData: (prev) => prev,
  });
}

export function useOrderDetail(id: string | null) {
  return useQuery({
    queryKey: ORDER_KEYS.detail(id ?? ''),
    queryFn: () => orderApi.getOrder(id as string),
    enabled: Boolean(id),
  });
}

export function useOrderItems(id: string | null) {
  return useQuery({
    queryKey: ORDER_KEYS.items(id ?? ''),
    queryFn: () => orderApi.getOrderItems(id as string),
    enabled: Boolean(id),
  });
}

export function useOrderNotes(id: string | null) {
  return useQuery({
    queryKey: ORDER_KEYS.notes(id ?? ''),
    queryFn: () => orderApi.listNotes(id as string),
    enabled: Boolean(id),
  });
}

export function useOrderTimeline(id: string | null) {
  return useQuery({
    queryKey: ORDER_KEYS.timeline(id ?? ''),
    queryFn: () => orderApi.getTimeline(id as string),
    enabled: Boolean(id),
  });
}

export function useOrderStats() {
  return useQuery({
    queryKey: ORDER_KEYS.stats,
    queryFn: () => orderApi.getOrderStats(),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => orderApi.createOrder(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.stats });
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOrderInput }) => orderApi.updateOrder(id, input),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.detail(vars.id) });
    },
  });
}

export function useTransitionOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: OrderStatus; reason?: string }) =>
      orderApi.transitionOrder(id, status, reason),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.detail(order.id) });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.timeline(order.id) });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.stats });
    },
  });
}

export function useCreateRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { amount: number; reason?: string } }) =>
      orderApi.createRefund(id, input),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.detail(vars.id) });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.timeline(vars.id) });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.stats });
    },
  });
}

export function useProcessRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, refundId }: { orderId: string; refundId: string }) =>
      orderApi.processRefund(orderId, refundId),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.detail(vars.orderId) });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.timeline(vars.orderId) });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.stats });
    },
  });
}

export function usePredictFulfillment(orderId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => orderApi.predictFulfillment(orderId as string),
    onSuccess: () => {
      if (orderId) void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.detail(orderId) });
    },
  });
}

export function useCheckFraud(orderId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => orderApi.checkFraud(orderId as string),
    onSuccess: () => {
      if (orderId) {
        void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.all });
        void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.detail(orderId) });
      }
    },
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { body: string; pinned?: boolean } }) =>
      orderApi.createNote(id, input),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.notes(vars.id) });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.timeline(vars.id) });
    },
  });
}

export function useUpdateOrderItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId, input }: { orderId: string; itemId: string; input: { quantity?: number; note?: string | null } }) =>
      orderApi.updateOrderItem(orderId, itemId, input),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.items(vars.orderId) });
      void queryClient.invalidateQueries({ queryKey: ORDER_KEYS.detail(vars.orderId) });
    },
  });
}
