/**
 * WCO QA — k6: API smoke/regression load.
 *
 * A realistic buyer journey against the API: auth → catalog → order → payment.
 * Thresholds are derived from the SLO budget (see docs/runbooks/slo.md):
 *   p(95) latency < 500ms, error rate < 1%.
 *
 * Run (after deploying the API to a target env):
 *   k6 run -e BASE_URL=https://api.staging.wco.africa infra/qa/k6/buyer-journey.js
 *
 * Env vars: BASE_URL (default http://localhost:4000), VUS, DURATION.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:4000';

const errorRate = new Rate('wco_errors');
const latTrend = new Trend('wco_latency_ms', true);

export const options = {
  scenarios: {
    // Steady smoke regression — runs in every QA gate.
    smoke: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS ?? 20),
      duration: __ENV.DURATION ?? '1m',
    },
  },
  thresholds: {
    'wco_latency_ms{type:buyer}': ['p(95)<500', 'p(99)<1000'],
    wco_errors: ['rate<0.01'], // <1% errors
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

/** Bearer token obtained once per VU (kept in the VU's own memory). */
function auth() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: __ENV.QA_EMAIL ?? 'qa@wco.test',
      password: __ENV.QA_PASSWORD ?? 'SeCure-QA-2025!',
    }),
    { tags: { type: 'auth' }, headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'login 200': (r) => r.status === 200 });
  if (res.status !== 200) errorRate.add(1);
  return res.json('data.accessToken');
}

export default function () {
  const token = auth();
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    'X-Store-Id': 'mch_e2e',
    'Content-Type': 'application/json',
  };

  const started = Date.now();

  // Catalog browse
  const products = http.get(
    `${BASE_URL}/api/v1/products?page=1&pageSize=20`,
    { headers: authHeaders, tags: { type: 'catalog' } },
  );
  check(products, { 'products 200': (r) => r.status === 200 });

  // Order create (happy path)
  const order = http.post(
    `${BASE_URL}/api/v1/orders`,
    JSON.stringify({
      customerPhone: '+2348012345678',
      channel: 'WHATSAPP',
      items: [{ productId: (products.json('data.items') ?? [{}])[0]?.id ?? 'p1', quantity: 1 }],
    }),
    { headers: authHeaders, tags: { type: 'order' } },
  );
  check(order, {
    'order 201': (r) => r.status === 201 || r.status === 200,
    'order has id': (r) => !!r.json('data.id'),
  });

  // Payment intent
  const payment = http.post(
    `${BASE_URL}/api/v1/payments`,
    JSON.stringify({ orderId: order.json('data.id'), provider: 'paystack' }),
    { headers: authHeaders, tags: { type: 'payment' } },
  );
  check(payment, { 'payment 200': (r) => r.status === 200 });

  latTrend.add(Date.now() - started, { type: 'buyer' });
  sleep(0.2);
}
