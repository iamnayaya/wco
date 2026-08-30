import { test, expect, Page } from '@playwright/test';
import { mockApi, seedSessionInStorage } from './helpers';

/**
 * End-to-end: orders list + status transitions (own click-to-cancel style).
 * Session pre-seeded so the client auth gate is bypassed; API mocked to the
 * same `{success, data, meta}` envelope the real `api()` client returns.
 */

const ORDERS = [
  {
    id: 'o1',
    orderNumber: 'WCO-9001',
    status: 'PAID',
    total: 12500,
    currency: 'NGN',
    createdAt: '2025-02-01T10:00:00.000Z',
    customer: { id: 'c1', name: 'Chiamaka Eze', waPhone: '+2348012345678' },
  },
  {
    id: 'o2',
    orderNumber: 'WCO-9002',
    status: 'PROCESSING',
    total: 4700,
    currency: 'NGN',
    createdAt: '2025-02-01T09:30:00.000Z',
    customer: { id: 'c2', name: 'Oluwaseun Ade', waPhone: '+2348033334444' },
  },
];

async function openOrders(page: Page) {
  const session = sessionFixture();
  await seedSessionInStorage(page, session);
  await mockApi(page, {
    // Envelope: data = array, meta.pagination = paging info
    '/orders/v2*': {
      success: true,
      data: ORDERS,
      meta: { pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 } },
    },
    '/orders/stats': {
      total: 2,
      revenue: 17200,
      avgOrderValue: 8600,
      fulfilmentRate: 0.5,
      ordersToday: 1,
    },
    '/orders/o1': ORDERS[0],
    '/orders/o1/items': [],
    '/orders/o1/notes': [],
    '/orders/o1/timeline': [],
    '/orders/o2': ORDERS[1],
    '/orders/o2/items': [],
    '/orders/o2/notes': [],
    '/orders/o2/timeline': [],
  });
  await page.goto('/orders');
  return session;
}

function sessionFixture() {
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

test.describe('orders', () => {
  test('renders the orders page with a summary and table', async ({ page }) => {
    await openOrders(page);
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expect(page.getByRole('button', { name: /\+ New order/i })).toBeVisible();
    // Table rows for both mocked orders render.
    await expect(page.getByText('WCO-9001')).toBeVisible();
    await expect(page.getByText('WCO-9002')).toBeVisible();
  });

  test('opens the create-order modal and closes it', async ({ page }) => {
    await openOrders(page);
    await page.getByRole('button', { name: /\+ New order/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
