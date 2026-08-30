/**
 * WCO Frontend — lightweight visual regression harness.
 *
 * Captures full-page screenshots of key authenticated routes against the
 * running app (with the API mocked in-process) and diffs them against checked-in
 * baselines using pixelmatch. Regenerating the baseline warms the diff set;
 * from then on any unintended pixel drift fails the run.
 *
 * Usage:
 *   node scripts/visual-regression.mjs                  # compare current vs baseline
 *   node scripts/visual-regression.mjs --update          # (re)write baselines
 *   node scripts/visual-regression.mjs --route=/orders   # single route
 *   E2E_BASE_URL=https://dev.wco.com node scripts/visual-regression.mjs
 *
 * Exit code is non-zero when any changed route exceeds MAX_DIFF_RATIO.
 */
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const outDir = join(root, 'tests/visual/current');
const baseDir = join(root, 'tests/visual/baselines');
const diffDir = join(root, 'tests/visual/diffs');

const args = process.argv.slice(2);
const update = args.includes('--update');
const onlyRoute = args.find((a) => a.startsWith('--route='))?.split('=')[1];
const MAX_DIFF_RATIO = Number(process.env.MAX_DIFF_RATIO ?? 0.01);
const VIEWPORT = { width: 1280, height: 900 };

/** Routes under visual watch + the API mocks they need. */
const ROUTES = {
  '/dashboard': { '/analytics/summary': dashboardSummary(), '/orders': { items: [], nextCursor: null }, '/analytics/top-products': [], '/messages': [], '/dashboard/tasks': [], '/ai/insights': [] },
  '/orders': { '/orders/v2*': { success: true, data: orders(), meta: { pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 } } }, '/orders/stats': stats() },
  '/products': { '/products*': { items: [], nextCursor: null } },
  '/customers': { '/customers*': { items: [], nextCursor: null } },
  '/analytics': { '/analytics/summary': dashboardSummary(), '/analytics/top-products': [], '/analytics/funnel*': {} },
};

function session() {
  return {
    accessToken: 'at',
    refreshToken: 'rt',
    expiresIn: 900,
    user: { id: 'usr_1', email: 'nkechi@wco.test', fullName: 'Nkechi Okafor', role: 'OWNER', merchant: { id: 'mch_1', companyName: 'MNC', plan: 'pro' } },
  };
}
function dashboardSummary() {
  return { totalOrders: 42, revenue: 894320, avgOrderValue: 21293, fulfilmentRate: 0.91, activeCustomers: 318, pendingOrders: 3, salesTrend: [], ordersByDay: [], channelMix: [] };
}
function orders() {
  return [
    { id: 'o1', orderNumber: 'WCO-9001', status: 'PAID', total: 12500, currency: 'NGN', createdAt: '2025-02-01T10:00:00.000Z', customer: { id: 'c1', name: 'Chiamaka Eze', waPhone: '+2348012345678' } },
    { id: 'o2', orderNumber: 'WCO-9002', status: 'PROCESSING', total: 4700, currency: 'NGN', createdAt: '2025-02-01T09:30:00.000Z', customer: { id: 'c2', name: 'Oluwaseun Ade', waPhone: '+2348033334444' } },
  ];
}
function stats() {
  return { total: 2, revenue: 17200, avgOrderValue: 8600, fulfilmentRate: 0.5, ordersToday: 1 };
}

function matchGlob(input, pattern) {
  const rx = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  return rx.test(input);
}

async function mockApi(page, mocks) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const rel = url.pathname.replace(/^\/api\/v1/, '');
    for (const [p, v] of Object.entries(mocks)) {
      if (matchGlob(rel, p)) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: v }) });
        return;
      }
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }) });
  });
}

const nameOf = (route) => (route === '/' ? 'landing' : route.replace(/^\//, '').replace(/\//g, '__'));

const failures = [];

const browser = await chromium.launch();
try {
  for (const route of Object.keys(ROUTES)) {
    if (onlyRoute && route !== onlyRoute) continue;
    const page = await browser.newPage({ viewport: VIEWPORT });

    await page.addInitScript((s) => {
      window.localStorage.setItem('wco-auth', JSON.stringify({ state: { user: s.user, activeStoreId: s.user.merchant.id, refreshToken: s.refreshToken }, version: 0 }));
    }, session());

    await mockApi(page, ROUTES[route]);
    await page.goto(baseURL + route, { waitUntil: 'networkidle' });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 600)));

    const shot = await page.screenshot({ fullPage: true });
    const name = nameOf(route);
    const current = join(outDir, `${name}.png`);
    const base = join(baseDir, `${name}.png`);
    const diff = join(diffDir, `${name}.png`);

    mkdirSync(dirname(current), { recursive: true });
    writeFileSync(current, shot);

    if (update || !existsSync(base)) {
      mkdirSync(baseDir, { recursive: true });
      writeFileSync(base, shot);
      console.log(`[visual] ${route}: baseline ${existsSync(base) ? 'updated' : 'written'}`);
    } else {
      const a = PNG.sync.read(readFileSync(current));
      const b = PNG.sync.read(readFileSync(base));
      const { width, height } = a;
      const out = new PNG({ width, height });
      const diffPixels = pixelmatch(a.data, b.data, out.data, width, height, { threshold: 0.1 });
      const maxPixels = Math.max(1, width * height);
      const ratio = diffPixels / maxPixels;
      if (ratio > MAX_DIFF_RATIO) {
        mkdirSync(diffDir, { recursive: true });
        writeFileSync(diff, PNG.sync.write(out));
        failures.push({ route, ratio });
        console.log(`✗ ${route}: ${(ratio * 100).toFixed(2)}% different (threshold ${MAX_DIFF_RATIO * 100}%)`);
      } else {
        console.log(`✓ ${route}: ${(ratio * 100).toFixed(2)}% different`);
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error('\n[visual] FAILED:', failures.map((f) => `${f.route} (${(f.ratio * 100).toFixed(2)}%)`).join(', '));
  process.exit(1);
}
console.log('\n[visual] all routes within tolerance');
