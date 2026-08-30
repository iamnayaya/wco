import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  api,
  apiRaw,
  apiForm,
  ApiError,
  registerAuthProviders,
  setUnauthorizedHandler,
} from './client';

/**
 * Exercises the API client against a stubbed `fetch`. Confirms headers,
 * envelope unwrapping, error mapping, auth-provider injection and the 401
 * unauthorized callback all behave as specified.
 */

const good = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

describe('api()', () => {
  const fetcher = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetcher);
    registerAuthProviders(() => null, () => null);
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('GETs a path under /api/v1 and returns parsed JSON', async () => {
    fetcher.mockResolvedValue(good({ success: true, data: { id: 'x' } }));
    const data = await api<{ success: boolean; data: { id: string } }>('/orders');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain('/api/v1/orders');
    expect(init.method).toBe('GET');
    expect(data).toEqual({ success: true, data: { id: 'x' } });
  });

  it('sends JSON body, content-type and idempotency key for mutations', async () => {
    fetcher.mockResolvedValue(good({ success: true, data: {} }));
    await api('/orders', {
      method: 'POST',
      body: { a: 1 },
      idempotencyKey: 'idem-1',
    });
    const [, init] = fetcher.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['X-Idempotency-Key']).toBe('idem-1');
  });

  it('injects Authorization and X-Store-Id when providers are registered', async () => {
    registerAuthProviders(() => 'tok', () => 'store_1');
    fetcher.mockResolvedValue(good({ success: true, data: {} }));
    await api('/auth/me');
    const [, init] = fetcher.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(init.headers['X-Store-Id']).toBe('store_1');
  });

  it('appends query params only when defined', async () => {
    fetcher.mockResolvedValue(good({ success: true, data: {} }));
    await api('/orders', { params: { limit: 10, status: undefined } });
    const [url] = fetcher.mock.calls[0];
    expect(String(url)).toContain('limit=10');
    expect(String(url)).not.toContain('status');
  });

  it('throws an ApiError with status/code/message on failure', async () => {
    const errBody = { code: 'VALIDATION_ERROR', message: 'bad input', details: { a: 'x' } };
    fetcher.mockResolvedValue(new Response(JSON.stringify(errBody), { status: 422 }));
    const promise = api('/orders', { method: 'POST', body: {} });
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ status: 422, code: 'VALIDATION_ERROR' });
  });

  it('calls the unauthorized handler exactly once on 401', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ code: 'UNAUTHORIZED', message: 'nope' }), { status: 401 }),
    );
    await expect(api('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('maps 204 to undefined', async () => {
    fetcher.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api('/orders/full-delete')).resolves.toBeUndefined();
  });
});

describe('apiRaw / apiForm', () => {
  const fetcher = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetcher);
    registerAuthProviders(() => null, () => null);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('apiRaw returns the raw Response for CSV export', async () => {
    fetcher.mockResolvedValue(
      new Response('a,b\n1,2', { status: 200, headers: { 'Content-Type': 'text/csv' } }),
    );
    const res = await apiRaw('/orders/export.csv');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv');
  });

  it('apiForm sends a multipart body', async () => {
    fetcher.mockResolvedValue(good({ success: true, data: { rows: 5 } }));
    const file = new Blob(['x'], { type: 'text/csv' });
    const res = await apiForm<{ success: boolean; data: { rows: number } }>(
      '/orders/import',
      file,
    );
    expect(res.data.rows).toBe(5);
    const [, init] = fetcher.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers['Content-Type']).toBeUndefined(); // multipart sets its own
  });
});
