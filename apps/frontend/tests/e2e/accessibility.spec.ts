import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockApi, seedSessionInStorage } from './helpers';

/**
 * Accessibility regression (WCAG 2.1 AA) via automated axe scans on key
 * authenticated routes. Fails the build on any serious violation.
 */

const AXE_SERIOUSNESS: Array<'critical' | 'serious'> = ['critical', 'serious'];

function session() {
  return {
    accessToken: 'at',
    refreshToken: 'rt',
    expiresIn: 900,
    user: {
      id: 'usr_1',
      email: 'nkechi@wco.test',
      fullName: 'Nkechi Okafor',
      role: 'OWNER',
      merchant: { id: 'mch_1', companyName: 'MNC', plan: 'pro' },
    },
  };
}

async function seedApp(page: Page) {
  await seedSessionInStorage(page, session());
  await mockApi(page, {
    '/auth/me': session().user,
    '/analytics/summary': {
      totalOrders: 42, revenue: 894320, avgOrderValue: 21293,
      fulfilmentRate: 0.91, activeCustomers: 318, pendingOrders: 3,
      salesTrend: [], ordersByDay: [], channelMix: [],
    },
    '/orders*': { items: [], nextCursor: null, meta: { pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 } } },
    '/orders/stats': { total: 0, revenue: 0, avgOrderValue: 0, fulfilmentRate: 0 },
    '/analytics/top-products': [],
    '/messages': [],
    '/dashboard/tasks': [],
    '/ai/insights': [],
    '/products*': { items: [], nextCursor: null },
    '/customers*': { items: [], nextCursor: null },
    '/conversations*': [],
    '/stores': [],
  });
}

const ROUTES = [
  '/dashboard',
  '/orders',
  '/products',
  '/customers',
  '/conversations',
  '/analytics',
  '/settings',
];

test.describe('accessibility (WCAG 2.1 AA)', () => {
  for (const route of ROUTES) {
    test(`${route} has no critical or serious axe violations`, async ({ page }) => {
      await seedApp(page);
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const blockers = results.violations.filter((v) =>
        AXE_SERIOUSNESS.includes(v.impact as never),
      );

      expect(
        blockers.map((v) => `${v.id}: ${v.help} (${v.impact})`),
      ).toEqual([]);
    });
  }
});
