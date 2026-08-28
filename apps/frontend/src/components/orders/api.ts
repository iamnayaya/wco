import {
  api,
  apiRaw,
  apiForm,
  downloadCsv,
  type ApiEnvelope,
  type PaginationMeta,
} from '../../lib/api/client';
import type {
  FraudVerdict,
  FulfillmentPrediction,
  ImportReport,
  ListOrdersParams,
  OrderChannel,
  OrderItem,
  OrderNote,
  OrderStats,
  OrdersListResult,
  OrderStatus,
  OrderWithItems,
  Refund,
  Timeline,
} from './types';

/**
 * Typed orders API surface. Every call reads the `{success, data, meta}`
 * envelope and returns the unwrapped payload. Mutations where the backend
 * supports it carry an idempotency key. All requests attach X-Store-Id +
 * bearer token via the shared `api` client.
 */

function sortParams(params: ListOrdersParams): Record<string, string | number | undefined> {
  return {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    status: params.status || undefined,
    channel: params.channel || undefined,
    customerId: params.customerId || undefined,
    q: params.q || undefined,
    minTotal: params.minTotal,
    maxTotal: params.maxTotal,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    sortBy: params.sortBy ?? 'createdAt',
    sortOrder: params.sortOrder ?? 'desc',
  };
}

export async function listOrders(params: ListOrdersParams): Promise<OrdersListResult> {
  const envelope = await api<ApiEnvelope<OrdersListResult['items'], { pagination: PaginationMeta }>>('/orders/v2', {
    params: sortParams(params),
  });
  const meta = envelope.meta?.pagination ?? {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    totalItems: envelope.data.length,
    totalPages: 1,
  };
  return { items: envelope.data, meta };
}

export async function getOrder(id: string): Promise<OrderWithItems> {
  const envelope = await api<ApiEnvelope<OrderWithItems>>(`/orders/${id}`);
  return envelope.data;
}

export interface CreateOrderInput {
  items: Array<{ productId: string; variantId?: string; quantity: number; note?: string }>;
  customerId?: string;
  customerPhone?: string;
  channel?: OrderChannel;
  discount?: number;
  deliveryFee?: number;
  notes?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
}

export async function createOrder(input: CreateOrderInput): Promise<OrderWithItems> {
  const envelope = await api<ApiEnvelope<OrderWithItems>>('/orders', {
    method: 'POST',
    body: input,
    idempotencyKey: crypto.randomUUID(),
  });
  return envelope.data;
}

export interface UpdateOrderInput {
  notes?: string;
  deliveryAddress?: string | null;
  deliveryCity?: string | null;
}

export async function updateOrder(id: string, input: UpdateOrderInput): Promise<OrderWithItems> {
  const envelope = await api<ApiEnvelope<OrderWithItems>>(`/orders/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return envelope.data;
}

export async function transitionOrder(
  id: string,
  status: OrderStatus,
  reason?: string,
): Promise<OrderWithItems> {
  const envelope = await api<ApiEnvelope<OrderWithItems>>(`/orders/${id}/status`, {
    method: 'PUT',
    body: { status, reason },
  });
  return envelope.data;
}

export async function createRefund(
  id: string,
  input: { amount: number; reason?: string },
): Promise<Refund> {
  const envelope = await api<ApiEnvelope<Refund>>(`/orders/${id}/refunds`, {
    method: 'POST',
    body: input,
    idempotencyKey: crypto.randomUUID(),
  });
  return envelope.data;
}

export async function processRefund(
  orderId: string,
  refundId: string,
): Promise<{ refund: Refund; order: OrderWithItems; orderRefunded: boolean }> {
  const envelope = await api<ApiEnvelope<{ refund: Refund; order: OrderWithItems; orderRefunded: boolean }>>(
    `/orders/${orderId}/refunds/${refundId}/process`,
    { method: 'POST' },
  );
  return envelope.data;
}

export async function predictFulfillment(id: string): Promise<FulfillmentPrediction> {
  const envelope = await api<ApiEnvelope<FulfillmentPrediction>>(`/orders/${id}/ai/predict-fulfillment`, {
    method: 'POST',
  });
  return envelope.data;
}

export async function checkFraud(id: string): Promise<FraudVerdict> {
  const envelope = await api<ApiEnvelope<FraudVerdict>>(`/orders/${id}/ai/fraud-check`, { method: 'POST' });
  return envelope.data;
}

export async function getTimeline(id: string): Promise<Timeline> {
  const envelope = await api<ApiEnvelope<Timeline>>(`/orders/${id}/timeline`);
  return envelope.data;
}

export async function getOrderItems(id: string): Promise<OrderItem[]> {
  const envelope = await api<ApiEnvelope<OrderItem[]>>(`/orders/${id}/items`);
  return envelope.data;
}

export async function updateOrderItem(
  orderId: string,
  itemId: string,
  input: { quantity?: number; note?: string | null },
): Promise<OrderItem> {
  const envelope = await api<ApiEnvelope<OrderItem>>(`/orders/${orderId}/items/${itemId}`, {
    method: 'PUT',
    body: input,
  });
  return envelope.data;
}

export async function listNotes(id: string): Promise<OrderNote[]> {
  const envelope = await api<ApiEnvelope<OrderNote[]>>(`/orders/${id}/notes`);
  return envelope.data;
}

export async function createNote(id: string, input: { body: string; pinned?: boolean }): Promise<OrderNote> {
  const envelope = await api<ApiEnvelope<OrderNote>>(`/orders/${id}/notes`, {
    method: 'POST',
    body: input,
    idempotencyKey: crypto.randomUUID(),
  });
  return envelope.data;
}

export async function getOrderStats(): Promise<OrderStats> {
  const envelope = await api<ApiEnvelope<OrderStats>>('/orders/stats');
  return envelope.data;
}

export function exportOrdersCsv(params: ListOrdersParams = {}): void {
  void apiRaw('/orders/export', { params: sortParams({ ...params, page: 1, pageSize: 100 }) }).then((res) =>
    downloadCsv(res),
  );
}

export async function importOrdersCsv(file: File): Promise<ImportReport> {
  const envelope = await apiForm<ApiEnvelope<ImportReport>>('/orders/import', file, 'file');
  return envelope.data;
}
