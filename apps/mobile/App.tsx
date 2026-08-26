import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/app/navigation/RootNavigator';
import { hydrateSession } from './src/store/slices/auth-slice';

/**
 * WCO Mobile — merchant companion app.
 * Offline-first defaults mirror the web app: 60s stale time, exponential retry.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'offlineFirst', retry: 1 },
  },
});

export default function App() {
  React.useEffect(() => {
    void hydrateSession();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <RootNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
