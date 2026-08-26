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
