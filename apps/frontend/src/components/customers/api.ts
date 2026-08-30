import {
  api,
  apiRaw,
  apiForm,
  downloadCsv,
  type ApiEnvelope,
  type PaginationMeta,
} from '../../lib/api/client';
import type {
  AutoSegmentResult,
  Customer,
  CustomerNote,
  CustomerSegment,
  CustomerStats,
  CustomerTag,
  ImportResult,
  ListCustomersParams,
  MessageSummary,
  OrderSummary,
} from './types';

/**
 * Typed customers API surface — WhatsApp CRM directory (v2 offset listing).
 * Every call reads the `{success, data, meta}` envelope and returns the
 * unwrapped payload. All requests attach X-Store-Id + bearer token via the
 * shared `api` client. Import uses multipart (apiForm); export streams a raw
 * text body (apiRaw + downloadCsv).
 */

function listParams(params: ListCustomersParams): Record<string, string | number | undefined> {
  return {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    q: params.q || undefined,
    tag: params.tag || undefined,
    segment: params.segment || undefined,
    marketingOptIn: params.marketingOptIn === undefined ? undefined : String(params.marketingOptIn),
    minSpent: params.minSpent,
    maxSpent: params.maxSpent,
    sortBy: params.sortBy ?? 'createdAt',
    sortOrder: params.sortOrder ?? 'desc',
  };
}

export async function listCustomers(params: ListCustomersParams): Promise<{ items: Customer[]; meta: PaginationMeta }> {
  const envelope = await api<ApiEnvelope<Customer[], { pagination: PaginationMeta }>>('/customers', {
    params: listParams(params),
  });
  const meta = envelope.meta?.pagination ?? {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    totalItems: envelope.data.length,
    totalPages: 1,
  };
  return { items: envelope.data, meta };
}

export async function getCustomer(id: string): Promise<Customer> {
  const envelope = await api<ApiEnvelope<Customer>>(`/customers/${id}`);
  return envelope.data;
}

export interface CreateCustomerInput {
  waPhone: string;
  name?: string;
  email?: string;
  tags?: string[];
  marketingOptIn?: boolean;
  notes?: string;
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const envelope = await api<ApiEnvelope<Customer>>('/customers', {
    method: 'POST',
    body: input,
    idempotencyKey: crypto.randomUUID(),
  });
  return envelope.data;
}

export interface UpdateCustomerInput {
  name?: string;
  email?: string;
  notes?: string;
  marketingOptIn?: boolean;
  tags?: string[];
}

export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  const envelope = await api<ApiEnvelope<Customer>>(`/customers/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return envelope.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await api<ApiEnvelope<{ deleted: boolean }>>(`/customers/${id}`, { method: 'DELETE' });
}

export async function addCustomerTags(id: string, tags: string[]): Promise<Customer> {
  const envelope = await api<ApiEnvelope<Customer>>(`/customers/${id}/tags`, {
    method: 'POST',
    body: { tags },
  });
  return envelope.data;
}

// --- relationship feeds -----------------------------------------------------

export async function getCustomerStats(id: string): Promise<CustomerStats> {
  const envelope = await api<ApiEnvelope<CustomerStats>>(`/customers/${id}/stats`);
  return envelope.data;
}

export async function listCustomerOrders(id: string): Promise<OrderSummary[]> {
  const envelope = await api<ApiEnvelope<OrderSummary[]>>(`/customers/${id}/orders`);
  return envelope.data;
}

export async function listCustomerMessages(id: string): Promise<MessageSummary[]> {
  const envelope = await api<ApiEnvelope<MessageSummary[]>>(`/customers/${id}/messages`);
  return envelope.data;
}

// --- notes ------------------------------------------------------------------

export async function listNotes(id: string): Promise<CustomerNote[]> {
  const envelope = await api<ApiEnvelope<CustomerNote[]>>(`/customers/${id}/notes`);
  return envelope.data;
}

export async function createNote(id: string, input: { body: string; pinned?: boolean }): Promise<CustomerNote> {
  const envelope = await api<ApiEnvelope<CustomerNote>>(`/customers/${id}/notes`, {
    method: 'POST',
    body: input,
    idempotencyKey: crypto.randomUUID(),
  });
  return envelope.data;
}

export async function deleteNote(id: string, noteId: string): Promise<void> {
  await api<ApiEnvelope<{ deleted: boolean }>>(`/customers/${id}/notes/${noteId}`, { method: 'DELETE' });
}

// --- tag catalog ------------------------------------------------------------

export async function listTags(): Promise<CustomerTag[]> {
  const envelope = await api<ApiEnvelope<CustomerTag[]>>('/customer-tags');
  return envelope.data;
}

export async function createTag(input: { name: string; color?: string }): Promise<CustomerTag> {
  const envelope = await api<ApiEnvelope<CustomerTag>>('/customer-tags', {
    method: 'POST',
    body: input,
    idempotencyKey: crypto.randomUUID(),
  });
  return envelope.data;
}

// --- segments ---------------------------------------------------------------

export async function listSegments(): Promise<CustomerSegment[]> {
  const envelope = await api<ApiEnvelope<CustomerSegment[]>>('/customer-segments');
  return envelope.data;
}

export async function runAutoSegment(): Promise<AutoSegmentResult> {
  const envelope = await api<ApiEnvelope<AutoSegmentResult>>('/customer-segments/auto', { method: 'POST' });
  return envelope.data;
}

// --- export / import --------------------------------------------------------

export function exportCustomersCsv(params: ListCustomersParams = {}): void {
  void apiRaw('/customers/export', { params: listParams({ ...params, page: 1, pageSize: 100 }) }).then((res) =>
    downloadCsv(res, 'customers.csv'),
  );
}

export async function importCustomersCsv(file: File): Promise<ImportResult> {
  const envelope = await apiForm<ApiEnvelope<ImportResult>>('/customers/import', file, 'file');
  return envelope.data;
}
