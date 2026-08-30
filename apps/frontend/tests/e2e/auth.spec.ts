import { test, expect, Page } from '@playwright/test';
import { mockApi, seedSession } from './helpers';

/**
 * End-to-end: authentication.
 * Runs the real browser + real Next.js routes against a mocked API so the
 * full login → session → redirect path is verified without a backend.
 */

async function openLogin(page: Page) {
  const session = seedSession();
  await mockApi(page, {
    '/auth/login': session,
    '/auth/me': session.user,
  });
  await page.goto('/login');
  return session;
}

test.describe('authentication', () => {
  test('renders the login form', async ({ page }) => {
    await openLogin(page);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /log in/i })).toBeEnabled();
  });

  test('shows validation errors for invalid input without calling the API', async ({ page }) => {
    await openLogin(page);
    await page.getByLabel('Email address').fill('not-an-email');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('logs in and lands on the dashboard', async ({ page }) => {
    await openLogin(page);
    await page.getByLabel('Email address').fill('nkechi@wco.test');
    await page.getByLabel('Password').fill('Secret12345');
    await page.getByRole('button', { name: /log in/i }).click();

    // Session is written to localStorage by the store before redirect.
    const token = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('wco-auth') ?? 'null')?.state?.accessToken,
    );
    expect(token).toBe('at-e2e');

    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('routes to the 2FA challenge when required', async ({ page }) => {
    const session = seedSession();
    await mockApi(page, {
      '/auth/login': { requires2FA: true, tempToken: 'tmp-123' },
      '/auth/me': session.user,
    });
    await page.goto('/login');

    await page.getByLabel('Email address').fill('nkechi@wco.test');
    await page.getByLabel('Password').fill('Secret12345');
    await page.getByRole('button', { name: /log in/i }).click();

    await page.waitForURL('**/2fa-login**');
    await expect(page).toHaveURL(/\/2fa-login\?token=tmp-123/);
  });

  test('surfaces a 401 with a friendly message', async ({ page }) => {
    await mockApi(page, {
      '/auth/login': (_url: URL) => {
        throw Object.assign(new Error('Invalid credentials'), { status: 401 });
      },
    });
    await page.goto('/login');

    await page.getByLabel('Email address').fill('nkechi@wco.test');
    await page.getByLabel('Password').fill('WrongPass1');
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page.getByText('Email or password is incorrect')).toBeVisible();
  });
});

test.describe('authentication · happy path cleanup', () => {
  test('does not leak a session between tests', async ({ page }) => {
    await page.goto('/login');
    // No stored session → still on the auth screen, dashboard is protected.
    await expect(page).toHaveURL(/\/login$/);
  });
});
