import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api/client';
import { Card, Muted, Stat, Title } from '../../../components/ui';
import { formatMoney } from '../../lib/format';

interface Summary {
  today: { revenue: number; orders: number; newCustomers: number };
  week: { revenue: number; orders: number; aiResolutionRate: number };
}

export function HomeScreen() {
  const summary = useQuery({
    queryKey: ['summary'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Summary }>('/analytics/summary');
      return data.data;
    },
    refetchInterval: 60_000,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Title>Today</Title>
      <View style={styles.row}>
        <Stat label="Revenue" value={formatMoney(summary.data?.today.revenue ?? 0)} />
        <Stat label="Orders" value={String(summary.data?.today.orders ?? 0)} />
        <Stat label="New customers" value={String(summary.data?.today.newCustomers ?? 0)} />
      </View>

      <Card>
        <Title>This week</Title>
        <Muted>
          {formatMoney(summary.data?.week.revenue ?? 0)} from{' '}
          {summary.data?.week.orders ?? 0} orders
        </Muted>
        <Muted>
          AI handled {Math.round((summary.data?.week.aiResolutionRate ?? 0) * 100)}% of chats
          without you
        </Muted>
      </Card>

      {!summary.isLoading && !summary.data && (
        <Card>
          <Muted>Could not load stats — check your connection. Retrying automatically.</Muted>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  row: { flexDirection: 'row', gap: 10 },
});
