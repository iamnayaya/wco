import { createApp } from '../../src/app.js';
import { setupTestServer } from '../helpers/http.js';


/**
 * Live-infra integration: products catalog CRUD against real Postgres/Redis.
 *
 * Skipped unless RUN_INTEGRATION_TESTS=true AND a stack is reachable:
 *   docker compose -f infra/docker/docker-compose.yml up -d postgres redis
 *   npm run db:migrate && npm run db:seed   (from apps/backend)
 *   RUN_INTEGRATION_TESTS=true npm run test:integration
 */
const LIVE = process.env.RUN_INTEGRATION_TESTS === 'true';
const d = LIVE ? describe : describe.skip;

d('products API (live Postgres/Redis)', () => {
  const app = createApp();
const req = setupTestServer(app);
  let accessToken = '';
  let storeId = '';
  const email = `catalog-${Date.now()}@wco.test`;

  beforeAll(async () => {
    const signup = await req()
      .post('/api/v1/auth/signup')
      .send({ companyName: 'Catalog Co', fullName: 'Cat Owner', email, password: 'Sup3rSecret!' });
    accessToken = signup.body.data.accessToken;
    const merchantId = signup.body.data.user.merchantId;

    // The first active store is auto-resolved by tenantScope.
    const dbSetup = await req()
      .post('/api/v1/stores')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Main Market', country: 'NG' });
    if (dbSetup.status === 201) storeId = dbSetup.body.data.id;
    void merchantId;
  });

  it('creates, reads, updates and archives a product', async () => {
    const headers = { Authorization: `Bearer ${accessToken}`, 'X-Store-Id': storeId };

    const created = await req()
      .post('/api/v1/products')
      .set(headers)
      .send({ name: 'Garri Ijebu', sku: `GAR-${Date.now()}`, price: 1500.5, stockQuantity: 40 });
    expect(created.status).toBe(201);
    const productId = created.body.data.id;

    const got = await req().get(`/api/v1/products/${productId}`).set(headers);
    expect(got.status).toBe(200);
    expect(got.body.data.name).toBe('Garri Ijebu');

    const updated = await req()
      .patch(`/api/v1/products/${productId}`)
      .set(headers)
      .send({ price: 1800 });
    expect(updated.body.data.price).toBe('1800'); // Decimal serializes as string

    const archived = await req().delete(`/api/v1/products/${productId}`).set(headers);
    expect(archived.status).toBe(200);

    const afterArchive = await req().get(`/api/v1/products/${productId}`).set(headers);
    expect(afterArchive.body.data.status).toBe('ARCHIVED');
  });

  it('rejects unauthenticated writes', async () => {
    const res = await req().post('/api/v1/products').send({ name: 'X', sku: 'X1', price: 1 });
    expect(res.status).toBe(401);
  });
});
