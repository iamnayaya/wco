import { vi } from 'vitest';

/**
 * WCO Frontend — centralised API mock.
 *
 * Suites `vi.mock('../lib/api/client')` and drive responses through these
 * helpers. This keeps every component/page test hermetic, fast, and free of
 * real network calls.
 */

export interface Queue {
  route: string;
  method: string;
  status?: number;
  body?: unknown;
  error?: { message: string; code?: string };
}

const routes = new Map<string, Queue[]>();

/** Register a canned response for a route. */
export function mockRoute(
  route: string,
  response: { method?: string; status?: number; body?: unknown; error?: { message: string; code?: string } },
): void {
  const key = routeKey(route, response.method ?? 'GET');
  if (!routes.has(key)) routes.set(key, []);
  routes.get(key)!.push({
    route: key,
    method: response.method ?? 'GET',
    status: response.status,
    body: response.body,
    error: response.error,
  });
}

/** Convenience: mock a successful GET returning `body`. */
export function mockGet(route: string, body: unknown): void {
  mockRoute(route, { method: 'GET', status: 200, body });
}

/** Convenience: mock a mutation returning `body`. */
export function mockMutation(route: string, method: string, body: unknown): void {
  mockRoute(route, { method, status: 201, body });
}

/** Convenience: simulate an error response. */
export function mockError(route: string, method: string, message: string, code = 'BAD_REQUEST'): void {
  mockRoute(route, { method, status: 400, error: { message, code } });
}

export function resetMocks(): void {
  routes.clear();
}

/**
 * Factory for the mocked `api` export. Tests do:
 *   import { apiMock } from '../tests/utils/api-mock';
 *   const api = vi.fn(apiMock.impl);
 */
export function createApiMock() {
  return vi.fn(async (route: string, options?: { method?: string }) => {
    const key = routeKey(route, options?.method ?? 'GET');
    const queue = routes.get(key);
    const canned = queue?.shift();

    if (!canned) {
      const err = new Error(`No mock registered for ${key}`);
      (err as { code?: string }).code = 'NO_MOCK';
      throw err;
    }

    if (canned.error) {
      const e = new Error(canned.error.message);
      (e as { status?: number; code?: string }).status = canned.status ?? 400;
      (e as { code?: string }).code = canned.error.code;
      throw e;
    }

    return canned.body;
  });
}

function routeKey(route: string, method: string): string {
  return `${method} ${route}`;
}
