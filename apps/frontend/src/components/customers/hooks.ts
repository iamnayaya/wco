'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as customerApi from './api';
import type { CreateCustomerInput, UpdateCustomerInput } from './api';
import type { ListCustomersParams } from './types';

const CUSTOMER_KEYS = {
  all: ['customers'] as const,
  list: (params: ListCustomersParams) => ['customers', 'list', params] as const,
  detail: (id: string) => ['customers', 'detail', id] as const,
  stats: (id: string) => ['customers', 'stats', id] as const,
  orders: (id: string) => ['customers', 'orders', id] as const,
  messages: (id: string) => ['customers', 'messages', id] as const,
  notes: (id: string) => ['customers', 'notes', id] as const,
  tags: ['customer-tags'] as const,
  segments: ['customer-segments'] as const,
};

export function useCustomersList(params: ListCustomersParams) {
  return useQuery({
    queryKey: CUSTOMER_KEYS.list(params),
    queryFn: () => customerApi.listCustomers(params),
    placeholderData: (prev) => prev,
  });
}

export function useCustomerDetail(id: string | null) {
  return useQuery({
    queryKey: CUSTOMER_KEYS.detail(id ?? ''),
    queryFn: () => customerApi.getCustomer(id as string),
    enabled: Boolean(id),
  });
}

export function useCustomerStats(id: string | null) {
  return useQuery({
    queryKey: CUSTOMER_KEYS.stats(id ?? ''),
    queryFn: () => customerApi.getCustomerStats(id as string),
    enabled: Boolean(id),
  });
}

export function useCustomerOrders(id: string | null) {
  return useQuery({
    queryKey: CUSTOMER_KEYS.orders(id ?? ''),
    queryFn: () => customerApi.listCustomerOrders(id as string),
    enabled: Boolean(id),
  });
}

export function useCustomerMessages(id: string | null) {
  return useQuery({
    queryKey: CUSTOMER_KEYS.messages(id ?? ''),
    queryFn: () => customerApi.listCustomerMessages(id as string),
    enabled: Boolean(id),
  });
}

export function useCustomerNotes(id: string | null) {
  return useQuery({
    queryKey: CUSTOMER_KEYS.notes(id ?? ''),
    queryFn: () => customerApi.listNotes(id as string),
    enabled: Boolean(id),
  });
}

export function useTags() {
  return useQuery({
    queryKey: CUSTOMER_KEYS.tags,
    queryFn: () => customerApi.listTags(),
  });
}

export function useSegments() {
  return useQuery({
    queryKey: CUSTOMER_KEYS.segments,
    queryFn: () => customerApi.listSegments(),
  });
}

// --- mutations --------------------------------------------------------------

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCustomerInput) => customerApi.createCustomer(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.all });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCustomerInput }) =>
      customerApi.updateCustomer(id, input),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.detail(vars.id) });
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.stats(vars.id) });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerApi.deleteCustomer(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.all });
      void queryClient.removeQueries({ queryKey: CUSTOMER_KEYS.detail(id) });
    },
  });
}

export function useAddCustomerTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) => customerApi.addCustomerTags(id, tags),
    onSuccess: (customer) => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.detail(customer.id) });
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.stats(customer.id) });
    },
  });
}

export function useCreateCustomerNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { body: string; pinned?: boolean } }) =>
      customerApi.createNote(id, input),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.notes(vars.id) });
    },
  });
}

export function useDeleteCustomerNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, noteId }: { id: string; noteId: string }) => customerApi.deleteNote(id, noteId),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.notes(vars.id) });
    },
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color?: string }) => customerApi.createTag(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.tags });
    },
  });
}

export function useRunAutoSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => customerApi.runAutoSegment(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.all });
      void queryClient.invalidateQueries({ queryKey: CUSTOMER_KEYS.segments });
    },
  });
}
