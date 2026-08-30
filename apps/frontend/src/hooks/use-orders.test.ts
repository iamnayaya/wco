import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { renderWrappedHook, makeQueryClient } from '../../tests/utils/render-utils';
import { createApiMock, mockGet, mockMutation, resetMocks } from '../../tests/utils/api-mock';
import { useOrders, useUpdateOrderStatus } from './use-orders';

const api = createApiMock();
vi.mock('../lib/api/client', () => ({
  api: (...args: Parameters<typeof api.mock>) => api(...args),
  ApiError: class extends Error {},
}));

const ORDERS = {
  items: [
    { id: 'o1', orderNumber: 'WCO-1', status: 'PAID', total: 12500, createdAt: '2025-01-01' },
  ],
  nextCursor: null,
};

describe('useOrders', () => {
  beforeEach(() => resetMocks());

  it('returns the orders list from the API', async () => {
    mockGet('/orders', ORDERS);
    const { result } = renderWrappedHook(() => useOrders({ limit: 10 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].orderNumber).toBe('WCO-1');
  });

  it('passes filter params through to the request', async () => {
    mockGet('/orders', { items: [], nextCursor: null });
    renderWrappedHook(() => useOrders({ status: 'PAID', limit: 5 }));

    await waitFor(() => expect(api).toHaveBeenCalled());
    const [path, options] = api.mock.calls.find(([p]) => p === '/orders')!;
    expect(path).toBe('/orders');
    expect(options?.params).toMatchObject({ status: 'PAID', limit: 5 });
  });
});

describe('useUpdateOrderStatus', () => {
  it('sends a PATCH with the new status and invalidates caches', async () => {
    const qc = makeQueryClient();
    const invalidationSpy = vi.spyOn(qc, 'invalidateQueries');
    mockMutation('/orders/o1', 'PATCH', { id: 'o1', status: 'SHIPPED' });

    const { result } = renderWrappedHook(() => useUpdateOrderStatus(), { queryClient: qc });

    act(() => result.current.mutate({ id: 'o1', status: 'SHIPPED' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [path, options] = api.mock.calls.find(([p]) => p === '/orders/o1')!;
    expect(path).toBe('/orders/o1');
    expect(options?.method).toBe('PATCH');
    expect(options?.body).toEqual({ status: 'SHIPPED' });

    await waitFor(() => {
      expect(invalidationSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
      expect(invalidationSpy).toHaveBeenCalledWith({ queryKey: ['analytics'] });
    });
  });
});
