import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { apiClient } from '../../../lib/api/client';
import { Card, Muted, Title } from '../../../components/ui';
import { formatMoney, timeAgo } from '../../lib/format';

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  total: number | null;
  subtotal: number | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PAID: '#059669',
  DELIVERED: '#059669',
  PENDING_PAYMENT: '#d97706',
  PROCESSING: '#2563eb',
  SHIPPED: '#4f46e5',
  CANCELLED: '#dc2626',
  REFUNDED: '#64748b',
};

export function OrdersScreen() {
  const orders = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: OrderSummary[] } }>('/orders', {
        params: { limit: 50 },
      });
      return data.data.items;
    },
    refetchInterval: 30_000,
  });

  return (
    <View style={styles.screen}>
      <FlashList
        data={orders.data ?? []}
        keyExtractor={(item) => item.id}
        estimatedItemSize={72}
        renderItem={({ item }) => (
          <Card style={{ marginHorizontal: 16, marginVertical: 4 }}>
            <View style={styles.row}>
              <Title>{item.orderNumber}</Title>
              <Title style={{ color: STATUS_COLORS[item.status] ?? '#64748b' }}>
                {formatMoney(item.total ?? item.subtotal ?? 0)}
              </Title>
            </View>
            <Muted>
              {item.status.replaceAll('_', ' ')} · {timeAgo(item.createdAt)}
            </Muted>
          </Card>
        )}
        ListEmptyComponent={
          !orders.isLoading ? (
            <Card style={styles.empty}>
              <Muted>No orders yet.</Muted>
            </Card>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  empty: { marginHorizontal: 16, marginTop: 16, alignItems: 'center' },
});
