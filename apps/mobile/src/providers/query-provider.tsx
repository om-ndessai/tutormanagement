import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { ApiRequestError } from '@/lib/api-client';

/**
 * TanStack Query, configured as the web app's main.tsx does: 30 s fresh, no retry on a 4xx.
 * The cache lives in memory only -- never persisted, because it holds lessons, notes and money,
 * and it is cleared on an organization switch and on sign-out.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);

  // Refetch stale queries when the app returns to the foreground (the web's window focus).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(
    () =>
      onlineManager.setEventListener((setOnline) => {
        const subscription = Network.addNetworkStateListener((state) =>
          setOnline(Boolean(state.isConnected)),
        );
        return () => subscription.remove();
      }),
    [],
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
