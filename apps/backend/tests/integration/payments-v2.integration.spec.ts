import { createApp } from '../../src/app.js';
import { setupTestServer } from '../helpers/http.js';
import { getInMemoryDb } from '../helpers/prisma-mock.js';
import { resetMemoryRedis } from '../helpers/redis-mock.js';

/**
 * Payment Management API — full HTTP stack over in-memory Prisma double.
 */

jest.mock('../../src/lib/prisma.js', () =>
  require('../helpers/prisma-mock').makePrismaExports(),
);
jest.mock('../../src/lib/redis.js', () => require('../helpers/redis-mock').makeRedisExports());
jest.mock('../../src/jobs/queues.js', () => ({
  enqueueWhatsappSend: jest.fn().mockResolvedValue(null),
  enqueueAiRespond: jest.fn().mockResolvedValue(null),
  enqueueEmail: jest.fn().mockResolvedValue(null),
  enqueueCampaignDispatch: jest.fn().mockResolvedValue(null),
  enqueueWebhookDelivery: jest.fn().mockResolvedValue(null),
  closeAllQueues: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/middleware/rate-limit.ts', () => ({
  defaultApiRateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  authRateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../src/lib/rabbit.js', () => ({
  publishDomainEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@wco/payments', () => ({
  buildPaymentProviders: () => ({
    PAYSTACK: {
      name: 'PAYSTACK',
      initialize: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://checkout.paystack.com/test',
        providerReference: 'wco_test_ref_001',
      }),
      verify: jest.fn().mockResolvedValue({
        status: 'SUCCEEDED',
        amountPaid: 5000,
        currency: 'NGN',
        paidAt: new Date(),
        fee: 75,
      }),
      refund: jest.fn().mockResolvedValue({ accepted: true, refundReference: 'ref_001' }),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    },
    FLUTTERWAVE: {
      name: 'FLUTTERWAVE',
      initialize: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://checkout.flutterwave.com/test',
        providerReference: 'wco_test_ref_002',
      }),
      verify: jest.fn().mockResolvedValue({ status: 'PENDING', amountPaid: 0, currency: 'NGN' }),
      refund: jest.fn().mockResolvedValue({ accepted: true }),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    },
  }),
}));

const app = createApp();
const req = setupTestServer(app);

let ownerHeaders: Record<string, string>;
let viewerHeaders: Record<string, string>;
let rivalHeaders: Record<string, string>;
let productId: string;
let customerId: string;

/** Helper: create a fresh order for each test that needs one */
async function createOrder(idempotencyKey: string): Promise<string> {
  const res = await req()
    .post('/api/v1/orders')
    .set(ownerHeaders)
    .set('X-Idempotency-Key', idempotencyKey)
    .send({ customerId, items: [{ productId, quantity: 1 }] });
  return res.body.data.id as string;
}

beforeAll(async () => {
  await resetMemoryRedis();

  const signup = await req()
    .post('/api/v1/auth/signup')
    .send({ companyName: 'Payment Corp', fullName: 'Pay Owner', email: 'pay-owner@test.com', password: 'Sup3rSecret!' });
  const token = signup.body.data.accessToken as string;
  const store = await req().post('/api/v1/stores').set('Authorization', `Bearer ${token}`).send({ name: 'Payment Store', country: 'NG' });
  const storeId = store.body.data.id as string;
  ownerHeaders = { Authorization: `Bearer ${token}`, 'X-Store-Id': storeId };

  await req()
    .post('/api/v1/users')
    .set(ownerHeaders)
    .send({ email: 'pay-viewer@test.com', fullName: 'Pay Viewer', role: 'VIEWER', temporaryPassword: 'Sup3rSecret!' });
  const viewerLogin = await req().post('/api/v1/auth/login').send({ email: 'pay-viewer@test.com', password: 'Sup3rSecret!' });
  viewerHeaders = { Authorization: `Bearer ${viewerLogin.body.data.accessToken}`, 'X-Store-Id': storeId };

  const rivalSignup = await req()
    .post('/api/v1/auth/signup')
    .send({ companyName: 'Rival Corp', fullName: 'Rival Owner', email: 'rival-pay@test.com', password: 'Sup3rSecret!' });
  const rivalToken = rivalSignup.body.data.accessToken as string;
  const rivalStore = await req().post('/api/v1/stores').set('Authorization', `Bearer ${rivalToken}`).send({ name: 'Rival Store', country: 'NG' });
  rivalHeaders = { Authorization: `Bearer ${rivalToken}`, 'X-Store-Id': rivalStore.body.data.id };

  const customerRes = await req()
    .post('/api/v1/customers')
    .set(ownerHeaders)
    .send({ waPhone: '+2348012345678', name: 'Test Customer' });
  customerId = customerRes.body.data.id as string;

  const productRes = await req()
    .post('/api/v1/products')
    .set(ownerHeaders)
    .send({ sku: 'PAY-RICE', name: 'Rice 5kg', price: 5000, stockQuantity: 100 });
  productId = productRes.body.data.id as string;
});

describe('Payment API', () => {
  describe('GET /payments/providers', () => {
    it('lists configured providers', async () => {
      const res = await req().get('/api/v1/payments/providers').set(ownerHeaders);
      expect(res.status).toBe(200);
      expect(res.body.data.providers).toContain('PAYSTACK');
      expect(res.body.data.providers).toContain('FLUTTERWAVE');
    });
  });

  describe('POST /payments/initialize', () => {
    it('initializes checkout for an order', async () => {
      const orderId = await createOrder('idem-init-001');
      const res = await req()
        .post('/api/v1/payments/initialize')
        .set(ownerHeaders)
        .set('X-Idempotency-Key', 'idem-init-002')
        .send({ orderId, provider: 'PAYSTACK' });

      expect(res.status).toBe(201);
      expect(res.body.data.payment).toBeDefined();
      expect(res.body.data.checkoutUrl).toContain('paystack.com');
      expect(res.body.data.payment.status).toBe('INITIALIZED');
    });

    it('rejects VIEWER role', async () => {
      const orderId = await createOrder('idem-viewer-init');
      const res = await req()
        .post('/api/v1/payments/initialize')
        .set(viewerHeaders)
        .send({ orderId, provider: 'PAYSTACK' });

      expect(res.status).toBe(403);
    });

    it('rejects invalid provider', async () => {
      const orderId = await createOrder('idem-invalid-prov');
      const res = await req()
        .post('/api/v1/payments/initialize')
        .set(ownerHeaders)
        .send({ orderId, provider: 'STRIPE' });

      expect(res.status).toBe(422);
    });
  });

  describe('GET /payments', () => {
    it('lists payments with offset pagination', async () => {
      const res = await req().get('/api/v1/payments').set(ownerHeaders);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.meta).toBeDefined();
      expect(res.body.data.meta.page).toBe(1);
    });

    it('filters by status', async () => {
      const res = await req().get('/api/v1/payments?status=INITIALIZED').set(ownerHeaders);
      expect(res.status).toBe(200);
      for (const p of res.body.data.items) {
        expect(p.status).toBe('INITIALIZED');
      }
    });

    it('filters by provider', async () => {
      const res = await req().get('/api/v1/payments?provider=PAYSTACK').set(ownerHeaders);
      expect(res.status).toBe(200);
      for (const p of res.body.data.items) {
        expect(p.provider).toBe('PAYSTACK');
      }
    });
  });

  describe('GET /payments/search', () => {
    it('searches by provider reference', async () => {
      const res = await req().get('/api/v1/payments/search?q=wco_test_ref').set(ownerHeaders);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });
  });

  describe('GET /payments/stats', () => {
    it('returns payment statistics', async () => {
      const res = await req().get('/api/v1/payments/stats').set(ownerHeaders);
      expect(res.status).toBe(200);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.summary.totalPayments).toBeGreaterThanOrEqual(0);
      expect(res.body.data.summary.successRate).toBeGreaterThanOrEqual(0);
      expect(res.body.data.byProvider).toBeDefined();
      expect(Array.isArray(res.body.data.byDay)).toBe(true);
    });

    it('accepts date range', async () => {
      const res = await req()
        .get('/api/v1/payments/stats?from=2024-01-01&to=2024-12-31&groupBy=month')
        .set(ownerHeaders);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /payments/export', () => {
    it('exports as CSV', async () => {
      const res = await req().get('/api/v1/payments/export?format=csv').set(ownerHeaders);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('exports as JSON', async () => {
      const res = await req().get('/api/v1/payments/export?format=json').set(ownerHeaders);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
    });

    it('rejects VIEWER role', async () => {
      const res = await req().get('/api/v1/payments/export').set(viewerHeaders);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /payments/send', () => {
    it('sends direct payment (no order)', async () => {
      const res = await req()
        .post('/api/v1/payments/send')
        .set(ownerHeaders)
        .set('X-Idempotency-Key', 'idem-send-001')
        .send({
          recipientPhone: '+2348098765432',
          amount: 3000,
          provider: 'PAYSTACK',
          description: 'Test direct payment',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.payment).toBeDefined();
      expect(res.body.data.checkoutUrl).toBeDefined();
    });

    it('rejects missing recipientPhone', async () => {
      const res = await req()
        .post('/api/v1/payments/send')
        .set(ownerHeaders)
        .send({ amount: 3000, provider: 'PAYSTACK' });

      expect(res.status).toBe(422);
    });
  });

  describe('POST /payments/generate-link', () => {
    it('generates payment link', async () => {
      const res = await req()
        .post('/api/v1/payments/generate-link')
        .set(ownerHeaders)
        .set('X-Idempotency-Key', 'idem-link-001')
        .send({
          amount: 10000,
          provider: 'FLUTTERWAVE',
          description: 'Payment for services',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.payment).toBeDefined();
      expect(res.body.data.checkoutUrl).toContain('flutterwave.com');
    });
  });

  describe('GET /payments/:id', () => {
    it('gets payment by ID', async () => {
      const orderId = await createOrder('idem-get-001');
      const initRes = await req()
        .post('/api/v1/payments/initialize')
        .set(ownerHeaders)
        .set('X-Idempotency-Key', 'idem-get-002')
        .send({ orderId, provider: 'PAYSTACK' });

      const paymentId = initRes.body.data.payment.id;
      const res = await req().get(`/api/v1/payments/${paymentId}`).set(ownerHeaders);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(paymentId);
    });

    it('returns 404 for non-existent payment', async () => {
      const res = await req().get('/api/v1/payments/nonexistent').set(ownerHeaders);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /payments/order/:orderId', () => {
    it('gets payment by order ID', async () => {
      const orderId = await createOrder('idem-order-get');
      await req()
        .post('/api/v1/payments/initialize')
        .set(ownerHeaders)
        .set('X-Idempotency-Key', 'idem-order-get-init')
        .send({ orderId, provider: 'PAYSTACK' });

      const res = await req().get(`/api/v1/payments/order/${orderId}`).set(ownerHeaders);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /payments/:id/verify', () => {
    it('verifies payment against PSP', async () => {
      const orderId = await createOrder('idem-verify-001');
      const initRes = await req()
        .post('/api/v1/payments/initialize')
        .set(ownerHeaders)
        .set('X-Idempotency-Key', 'idem-verify-002')
        .send({ orderId, provider: 'PAYSTACK' });

      const paymentId = initRes.body.data.payment.id;
      const res = await req().post(`/api/v1/payments/${paymentId}/verify`).set(ownerHeaders);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUCCEEDED');
    });
  });

  describe('POST /payments/:id/refund', () => {
    it('processes refund', async () => {
      const orderId = await createOrder('idem-refund-001');
      const initRes = await req()
        .post('/api/v1/payments/initialize')
        .set(ownerHeaders)
        .set('X-Idempotency-Key', 'idem-refund-002')
        .send({ orderId, provider: 'PAYSTACK' });
      const paymentId = initRes.body.data.payment.id;
      await req().post(`/api/v1/payments/${paymentId}/verify`).set(ownerHeaders);

      const res = await req()
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set(ownerHeaders)
        .send({ amount: 2000, reason: 'Partial refund' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('REFUNDED');
    });

    it('rejects VIEWER role', async () => {
      const res = await req()
        .post('/api/v1/payments/some-id/refund')
        .set(viewerHeaders)
        .send({ amount: 1000 });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /payments/:id/refunds', () => {
    it('lists refunds with pagination', async () => {
      const orderId = await createOrder('idem-refund-list-001');
      const initRes = await req()
        .post('/api/v1/payments/initialize')
        .set(ownerHeaders)
        .set('X-Idempotency-Key', 'idem-refund-list-002')
        .send({ orderId, provider: 'PAYSTACK' });
      const paymentId = initRes.body.data.payment.id;

      const res = await req().get(`/api/v1/payments/${paymentId}/refunds`).set(ownerHeaders);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(res.body.data.meta).toBeDefined();
    });
  });

  describe('GET /payments/:id/transactions', () => {
    it('lists transaction audit log', async () => {
      const orderId = await createOrder('idem-txn-001');
      const initRes = await req()
        .post('/api/v1/payments/initialize')
        .set(ownerHeaders)
        .set('X-Idempotency-Key', 'idem-txn-002')
        .send({ orderId, provider: 'PAYSTACK' });
      const paymentId = initRes.body.data.payment.id;

      const res = await req().get(`/api/v1/payments/${paymentId}/transactions`).set(ownerHeaders);
      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeDefined();
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });
  });

  describe('Tenant isolation', () => {
    it('rival store cannot see payments from test store', async () => {
      const orderId = await createOrder('idem-tenant-001');
      const initRes = await req()
        .post('/api/v1/payments/initialize')
        .set(ownerHeaders)
        .set('X-Idempotency-Key', 'idem-tenant-002')
        .send({ orderId, provider: 'PAYSTACK' });
      const paymentId = initRes.body.data.payment.id;

      const res = await req().get(`/api/v1/payments/${paymentId}`).set(rivalHeaders);
      expect(res.status).toBe(404);
    });
  });

  describe('Webhook ingestion', () => {
    it('accepts Paystack webhook (public route)', async () => {
      const res = await req()
        .post('/api/v1/webhooks/inbound/paystack')
        .set('x-paystack-signature', 'test-sig')
        .send({ event: 'charge.success', data: { reference: 'wco_test_ref_001', status: 'success', amount: 500000 } });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('rejects Paystack webhook without signature', async () => {
      const res = await req()
        .post('/api/v1/webhooks/inbound/paystack')
        .send({ event: 'charge.success', data: {} });

      expect(res.status).toBe(400);
    });

    it('accepts Flutterwave webhook (public route)', async () => {
      const res = await req()
        .post('/api/v1/webhooks/inbound/flutterwave')
        .set('verif-hash', 'test-hash')
        .send({ event: 'charge.completed', data: { id: 123, tx_ref: 'wco_test_ref_002', status: 'successful' } });

      expect(res.status).toBe(200);
    });
  });
});
