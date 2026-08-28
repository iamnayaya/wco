import { z } from 'zod';

/**
 * API client — typed, resilient, tenant-aware.
 * Used by TanStack Query hooks; never called directly from components.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Auth header injection without circular imports:
 * auth-slice registers a provider at store creation time.
 */
let tokenProvider: () => string | null = () => null;
let activeStoreProvider: () => string | null = () => null;

export function registerAuthProviders(
  getToken: () => string | null,
  getStoreId: () => string | null,
): void {
  tokenProvider = getToken;
  activeStoreProvider = getStoreId;
}

/** 401 handler — lets the app trigger refresh/logout centrally. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  params?: Record<string, string | number | undefined>;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, idempotencyKey, signal, params } = options;

  const url = new URL(`${API_URL}/api/v1${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const token = tokenProvider();
  const storeId = activeStoreProvider();

  const response = await fetch(url.toString(), {
    method,
    signal,
    credentials: 'include', // httpOnly refresh cookie
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(storeId ? { 'X-Store-Id': storeId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    if (response.status === 401 && onUnauthorized) onUnauthorized();
    throw new ApiError(
      response.status,
      errorBody?.code ?? 'UNKNOWN',
      errorBody?.message ?? `Request failed: ${response.status}`,
      errorBody?.details,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Typed endpoint schemas — single source of truth for the frontend contract
// ---------------------------------------------------------------------------

export const OrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: z.enum([
    'PENDING_PAYMENT',
    'PAID',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ]),
  subtotal: z.number().optional(),
  total: z.number().optional(),
  createdAt: z.string(),
});
export type Order = z.infer<typeof OrderSchema>;

export const PaginatedResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const listOrders = (params?: { cursor?: string; limit?: number; status?: string }) =>
  api<z.infer<ReturnType<typeof PaginatedResponse<typeof OrderSchema>>>>('/orders', {
    params,
  }).then((r) => PaginatedResponse(OrderSchema).parse(r));

export const createOrder = (
  input: {
    customerId: string;
    items: Array<{ productId: string; quantity: number; note?: string }>;
    channel: string;
    deliveryAddress?: string;
  },
) =>
  api<{ id: string; total: number }>('/orders', {
    method: 'POST',
    body: input,
    idempotencyKey: crypto.randomUUID(),
  });

export const confirmOrderPayment = (orderId: string, paymentReference: string) =>
  api<{ ok: boolean }>(`/orders/${orderId}/confirm-payment`, {
    method: 'POST',
    body: { paymentReference },
    idempotencyKey: orderId,
  });

// ---------------------------------------------------------------------------
// Envelope helpers — the backend wraps every 2xx response as
// `{ success: true, data, meta }`. Use these to read the unwrapped payload,
// and the raw/blob helpers for export/import.
// ---------------------------------------------------------------------------

export interface ApiEnvelope<T, M = unknown> {
  success: boolean;
  data: T;
  meta?: M;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Fetch a raw response body (not parsed JSON) — used for CSV export. */
export async function apiRaw(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = 'GET', body, idempotencyKey, signal, params } = options;
  const url = new URL(`${API_URL}/api/v1${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  const token = tokenProvider();
  const storeId = activeStoreProvider();
  const response = await fetch(url.toString(), {
    method,
    signal,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(storeId ? { 'X-Store-Id': storeId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    if (response.status === 401 && onUnauthorized) onUnauthorized();
    throw new ApiError(
      response.status,
      errorBody?.code ?? 'UNKNOWN',
      errorBody?.message ?? `Request failed: ${response.status}`,
      errorBody?.details,
    );
  }
  return response;
}

/**
 * Multipart upload — used for CSV order import. `field` is the form field the
 * backend reads (`file` for orders import). Only plain text/binary parts are
 * built here; callers pass a Blob/File.
 */
export async function apiForm<T>(path: string, file: Blob, field = 'file'): Promise<T> {
  const url = new URL(`${API_URL}/api/v1${path}`);
  const token = tokenProvider();
  const storeId = activeStoreProvider();
  const form = new FormData();
  form.append(field, file);
  const response = await fetch(url.toString(), {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(storeId ? { 'X-Store-Id': storeId } : {}),
    },
    body: form,
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    if (response.status === 401 && onUnauthorized) onUnauthorized();
    throw new ApiError(
      response.status,
      errorBody?.code ?? 'UNKNOWN',
      errorBody?.message ?? `Request failed: ${response.status}`,
      errorBody?.details,
    );
  }
  return (await response.json()) as T;
}

/** Read a raw export response as text and trigger a browser download. */
export function downloadCsv(response: Response, fallbackName = 'orders.csv'): void {
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] ?? fallbackName;
  void response.text().then((text) => {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  });
}
