import { Page } from '@playwright/test';

/**
 * WCO Frontend — Playwright E2E helpers.
 *
 * Most specs run against a mocked API layer: `mockApi(page, mocks)` routes
 * every `**/api/v1/**` call to canned JSON, so the full browser flow is
 * exercised without provisioning a backend. The envelope shape mirrors the
 * real `api()` client (`{ success, data, error }`).
 */

interface ApiMapping {
  /** Glob matched against the request URL path (relative, e.g. `/orders*`). */
  [pattern: string]: unknown | ((url: URL) => unknown);
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    merchant: { id: string; companyName: string; plan: string };
  };
}

/** Load the browser with the vite/next dev server base; reuse our mock. */
export async function mockApi(page: Page, mocks: ApiMapping): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const rel = url.pathname.replace(/^\/api\/v1/, '');
    let handled = false;

    for (const [pattern, value] of Object.entries(mocks)) {
      if (matchGlob(rel, pattern)) {
        const body = typeof value === 'function' ? (value as (u: URL) => unknown)(url) : value;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: body }),
        });
        handled = true;
        break;
      }
    }

    if (!handled) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'no mock' } }),
      });
    }
  });
}

export function seedSession(): AuthSession {
  return {
    accessToken: 'at-e2e',
    refreshToken: 'rt-e2e',
    expiresIn: 900,
    user: {
      id: 'usr_e2e',
      email: 'nkechi@wco.test',
      fullName: 'Nkechi Okafor',
      role: 'OWNER',
      merchant: { id: 'mch_e2e', companyName: 'Mama Nkechi Foods', plan: 'pro' },
    },
  };
}

/**
 * Populate the persisted (partialized) auth store before a page load so the
 * client-side auth gate lets the browser through to protected routes.
 * The partialize contract intentionally excludes the access token.
 */
export async function seedSessionInStorage(page: Page, session: AuthSession = seedSession()): Promise<void> {
  await page.addInitScript((s) => {
    window.localStorage.setItem(
      'wco-auth',
      JSON.stringify({
        state: {
          user: s.user,
          activeStoreId: s.user.merchant.id,
          refreshToken: s.refreshToken,
        },
        version: 0,
      }),
    );
  }, session);
}

export const ordersFixture = {
  items: [
    {
      id: 'o1',
      orderNumber: 'WCO-9001',
      status: 'PAID',
      total: 12500,
      currency: 'NGN',
      createdAt: '2025-02-01T10:00:00.000Z',
      customer: { name: 'Chiamaka Eze', phone: '+2348012345678' },
    },
    {
      id: 'o2',
      orderNumber: 'WCO-9002',
      status: 'PROCESSING',
      total: 4700,
      currency: 'NGN',
      createdAt: '2025-02-01T09:30:00.000Z',
      customer: { name: 'Oluwaseun Ade', phone: '+2348033334444' },
    },
  ],
  nextCursor: null,
};

/** Tiny glob matcher: `*` matches any sequence. */
function matchGlob(input: string, pattern: string): boolean {
  const rx = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return rx.test(input);
}
