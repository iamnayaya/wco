/**
 * WCO QA — k6: read-heavy soak / spike.
 *
 * A read-only mix (order list + stats) used for soak/regression and to enforce
 * p(95) budgets without mutating data. Enable the spike with -e MODE=spike.
 *
 * Run:
 *   k6 run -e BASE_URL=https://api.staging.wco.africa infra/qa/k6/read-flows.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:4000';
const MODE = __ENV.MODE ?? 'soak';
const errorRate = new Rate('wco_errors');

export const options = {
  scenarios: MODE === 'spike'
    ? {
        spike: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: '30s', target: 0 },
            { duration: '10s', target: 400 },
            { duration: '30s', target: 400 },
            { duration: '10s', target: 0 },
          ],
          gracefulRampDown: '10s',
        },
      }
    : {
        soak: {
          executor: 'constant-vus',
          vus: Number(__ENV.VUS ?? 50),
          duration: __ENV.DURATION ?? '5m',
        },
      },
  thresholds: {
    'wco_errors{fn:read}': ['rate<0.01'],
    'http_req_duration{fn:read}': ['p(95)<400', 'p(99)<800'],
  },
};

function auth() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: __ENV.QA_EMAIL ?? 'qa@wco.test', password: __ENV.QA_PASSWORD ?? 'SeCure-QA-2025!' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return res.status === 200 ? res.json('data.accessToken') : null;
}

export default function () {
  const token = auth();
  const headers = token ? { Authorization: `Bearer ${token}`, 'X-Store-Id': 'mch_e2e' } : {};

  const orders = http.get(`${BASE_URL}/api/v1/orders/v2?page=1&pageSize=50`, {
    headers,
    tags: { fn: 'read' },
  });
  check(orders, { 'orders list 200': (r) => r.status === 200 });

  const stats = http.get(`${BASE_URL}/api/v1/orders/stats`, {
    headers,
    tags: { fn: 'read' },
  });
  check(stats, { 'stats 200': (r) => r.status === 200 });

  if (orders.status !== 200 || stats.status !== 200) errorRate.add(1);
  sleep(0.5);
}
