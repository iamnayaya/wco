import { render, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactElement, type ReactNode } from 'react';
import { useAuthStore } from '@/store/slices/auth-slice';
import { session, user } from './fixtures';

/**
 * WCO Frontend — render helpers.
 * `renderWithProviders` wraps a component in a fresh QueryClient (retry off for
 * fast, deterministic failures) and seeds/clears the auth store so hooks and
 * pages behave like they do in the app.
 */

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
}

export interface RenderOpts {
  queryClient?: QueryClient;
  authenticated?: boolean;
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient = makeQueryClient(), authenticated = true }: RenderOpts = {},
): ReturnType<typeof render> {
  if (authenticated) {
    useAuthStore.getState().setSession(user, session.accessToken);
  } else {
    useAuthStore.getState().clearSession();
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return render(ui, { wrapper: Wrapper });
}

/**
 * `renderHookWithProviders` — like `renderWithProviders` but for hooks.
 * Returns a `Wrapped` wrapper you can pass to `renderHook` as `wrapper`, or
 * call `renderWrappedHook(hook, opts)` for convenience.
 */
export function renderWrappedHook<Result, Props>(
  hook: (props: Props) => Result,
  { queryClient = makeQueryClient(), authenticated = true }: RenderOpts = {},
) {
  if (authenticated) {
    useAuthStore.getState().setSession(user, session.accessToken);
  } else {
    useAuthStore.getState().clearSession();
  }

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook<Result, Props>(hook, { wrapper });
}
