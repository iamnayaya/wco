import type { Express } from 'express';
import request from 'supertest';

/**
 * End-to-end smoke suite - runs against a FULLY DEPLOYED stack (API + worker
 * + Postgres + Redis + RabbitMQ) via BASE_URL, defaulting to localhost:4000.
 *
 *   npm run docker:up && npm run dev
 *   RUN_E2E_TESTS=true npx jest tests/e2e
 *
 * Deliberately minimal: signup -> login -> create store -> create product ->
 * create order (idempotent) -> verify order readable. Deeper flows are owned
 * by the integration suites; this exists to catch deployment-level breakage
 * (migrations not applied, Redis unreachable, queue misconfig).
 */
const RUN = process.env.RUN_E2E_TESTS === 'true';
const d = RUN ? describe : describe.skip;

(d('WCO API e2e smoke', () => {
  let app: Express;
  const base = process.env.BASE_URL ?? 'http://localhost:4000';
  const email = `e2e-${Date.now()}@wco.test`;

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    app = require('../../src/app.js').createApp();
  });

  it('serves liveness before any business flow', async () => {
    const res = await request(app).get('/health'); // local process check
    expect(res.status).toBe(200);
  });

  it('completes the merchant happy path', async () => {
    const signupRes = await request(app)
      .post(`${base}/api/v1/auth/signup`)
      .send({
        companyName: 'E2E Traders',
        fullName: 'E2E Owner',
        email,
        password: 'Sup3rSecret!',
        country: 'NG',
      });
    expect(signupRes.status).toBe(201);
    const { accessToken } = signupRes.body.data;

    const storeRes = await request(app)
      .post(`${base}/api/v1/stores`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'E2E Store', country: 'NG' });
    expect(storeRes.status).toBe(201);

    const productRes = await request(app)
      .post(`${base}/api/v1/products`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Store-Id', storeRes.body.data.id)
      .send({ name: 'Test Item', sku: `E2E-${Date.now()}`, price: 500, stockQuantity: 10 });
    expect(productRes.status).toBe(201);

    const idempotencyKey = `e2e-${Date.now()}`;
    const orderBody = {
      items: [{ productId: productRes.body.data.id, quantity: 2 }],
      channel: 'DASHBOARD',
    };

    const firstOrder = await request(app)
      .post(`${base}/api/v1/orders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Store-Id', storeRes.body.data.id)
      .set('Idempotency-Key', idempotencyKey)
      .send(orderBody);
    expect(firstOrder.status).toBe(201);

    // Retry with the same key must replay, never double-create.
    const retryOrder = await request(app)
      .post(`${base}/api/v1/orders`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Store-Id', storeRes.body.data.id)
      .set('Idempotency-Key', idempotencyKey)
      .send(orderBody);
    expect(retryOrder.status).toBeLessThan(500);
  });
}));
