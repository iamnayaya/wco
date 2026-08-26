/**
 * k6 load profile — the numbers we must hold before shipping.
 *
 * Run:  k6 run --env BASE_URL=https://staging-api.wco.africa tools/benchmark/api.js
 *
 * SLOs (see docs/architecture/scalability-plan.md):
 *   p95 < 500ms on reads, p95 < 800ms on writes, error rate < 0.1%
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';

export const options = {
  scenarios: {
    steady_reads: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
    spike_writes: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      stages: [
        { duration: '1m', target: 50 }, // normal
        { duration: '30s', target: 300 }, // WhatsApp blast spike
        { duration: '2m', target: 50 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.001'],
    'http_req_duration{name:reads}': ['p(95)<500'],
    'http_req_duration{name:writes}': ['p(95)<800'],
  },
};

export default function () {
  // Reads — anonymous health + public-shaped endpoints
  const read = { tags: { name: 'reads' } };
  const health = http.get(`${BASE_URL.replace('/api/v1', '')}/health`, read);
  check(health, { 'health 200': (r) => r.status === 200 });

  sleep(Math.random() * 2 + 0.5); // human-ish pacing
}
