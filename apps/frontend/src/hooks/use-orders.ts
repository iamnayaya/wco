import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, PaginatedResponse, OrderSchema, type Order } from '../lib/api/client';

/** Orders list — cursor pagination preserved for infinite scroll. */
export function useOrders(params: { cursor?: string; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ['orders', params],
    queryFn: () =>
      api<{ items: Order[]; nextCursor: string | null }>('/orders', { params }),
    placeholderData: (prev) => prev,
  });
}

export type { Order };
export { PaginatedResponse, OrderSchema };

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api<Order>(`/orders/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
