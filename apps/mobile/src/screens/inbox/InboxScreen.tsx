import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { apiClient } from '../../../lib/api/client';
import { Card, Muted, Title } from '../../../components/ui';
import { timeAgo } from '../../lib/format';

interface ConversationSummary {
  id: string;
  customerName: string;
  customerPhone: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  status: string;
  unreadCount: number;
  botEnabled: boolean;
}

/** Inbox — read-first on mobile; replying happens in WhatsApp deep-link (v1). */
export function InboxScreen() {
  const conversations = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { items: ConversationSummary[] } }>('/conversations');
      return data.data.items;
    },
    refetchInterval: 15_000,
  });

  return (
    <View style={styles.screen}>
      <FlashList
        data={conversations.data ?? []}
        keyExtractor={(item) => item.id}
        estimatedItemSize={88}
        renderItem={({ item }) => (
          <Card style={{ marginHorizontal: 16, marginVertical: 4 }}>
            <View style={styles.row}>
              <Title>{item.customerName || item.customerPhone}</Title>
              <Muted>{timeAgo(item.lastMessageAt)}</Muted>
            </View>
            <Muted numberOfLines={2}>{item.lastMessagePreview}</Muted>
            <View style={[styles.row, styles.meta]}>
              <Muted>{item.botEnabled ? '🤖 AI on' : '👤 You'} · {item.status}</Muted>
              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Muted> {item.unreadCount}</Muted>
                </View>
              )}
            </View>
          </Card>
        )}
        ListEmptyComponent={
          !conversations.isLoading ? (
            <ScrollView contentContainerStyle={styles.empty}>
              <Muted>No conversations yet.</Muted>
            </ScrollView>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={conversations.isRefetching} onRefresh={() => void conversations.refetch()} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { marginTop: 6 },
  badge: { backgroundColor: '#059669', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  empty: { padding: 32, alignItems: 'center' },
});
