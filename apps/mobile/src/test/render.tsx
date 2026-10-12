// Render with the app's providers that a component needs offline: a fresh query client and the
// theme (the platform brand, light). Auth and the router are mocked per test where used.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ThemeProvider } from '@/providers/theme-provider';

export async function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}
