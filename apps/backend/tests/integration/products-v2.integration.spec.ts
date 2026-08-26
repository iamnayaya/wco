import { createApp } from '../../src/app.js';
import { setupTestServer } from '../helpers/http.js';
import { resetMemoryRedis } from '../helpers/redis-mock.js';

/**
 * Product Management v2 - full HTTP stack with the in-memory Prisma double.
 * Covers: CRUD + dup-SKU conflicts, offset pagination/filters/sort, tenant
 * isolation, RBAC, variants/images/discounts/inventory lifecycles, categories
 * + tags, CSV import/export, store stats, WhatsApp sync summary and the AI
 * enrichment endpoints (heuristic mode).
 */

jest.mock('../../src/lib/prisma.js', () =>
  require('../helpers/prisma-mock').makePrismaExports(),
);
jest.mock('../../src/lib/redis.js', () => require('../helpers/redis-mock').makeRedisExports());
jest.mock('../../src/services/uploads.service.js', () => ({
  uploadsService: {
    upload: jest.fn(async (_store: string, _folder: string, file: { originalname: string }) => ({
      key: `fake/${file.originalname}`,
      url: `https://cdn.test/${file.originalname}`,
    })),
    delete: jest.fn(async () => undefined),
  },
}));

const app = createApp();
const req = setupTestServer(app);

let ownerHeaders: Record<string, string>;
let viewerHeaders: Record<string, string>;
let otherStoreToken = '';
let storeId: string;

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  price: number | string;
  status?: string;
  categoryId?: string | null;
  stockQuantity?: number;
}

async function createProduct(overrides: Record<string, unknown> = {}): Promise<ProductRow> {
  const res = await req()
    .post('/api/v1/products')
    .set(ownerHeaders)
    .send({
      sku: `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      name: 'Generic Item',
      price: 1_000,
      ...overrides,
    });
  expect(res.status).toBe(201);
  return res.body.data as ProductRow;
}

beforeAll(async () => {
  const signup = await req()
    .post('/api/v1/auth/signup')
    .send({ companyName: 'Shop A', fullName: 'Owner One', email: 'owner@prod.test', password: 'Sup3rSecret!' });
  const token = signup.body.data.accessToken as string;
  const store = await req().post('/api/v1/stores').set('Authorization', `Bearer ${token}`).send({ name: 'Owner HQ', country: 'NG' });
  storeId = store.body.data.id;
  ownerHeaders = { Authorization: `Bearer ${token}`, 'X-Store-Id': storeId };

  await req()
    .post('/api/v1/users')
    .set(ownerHeaders)
    .send({ email: 'viewer@prod.test', fullName: 'View Only', role: 'VIEWER', temporaryPassword: 'Sup3rSecret!' });
  const viewerLogin = await req()
    .post('/api/v1/auth/login')
    .send({ email: 'viewer@prod.test', password: 'Sup3rSecret!' });
  viewerHeaders = { Authorization: `Bearer ${viewerLogin.body.data.accessToken}`, 'X-Store-Id': storeId };

  const rival = await req()
    .post('/api/v1/auth/signup')
    .send({ companyName: 'Shop B', fullName: 'Rival One', email: 'rival@prod.test', password: 'Sup3rSecret!' });
  otherStoreToken = rival.body.data.accessToken;

  // Seed catalog used by list/filter/stats tests.
  await createProduct({ sku: 'SEED-RICE', name: 'Rice 5kg', price: 8_500, stockQuantity: 40 });
  await createProduct({ sku: 'SEED-OIL', name: 'Groundnut Oil 2L', price: 5_200, stockQuantity: 3 });
  await createProduct({ sku: 'SEED-DRAFT', name: 'Unpublished Bundle', price: 900, status: 'DRAFT' });
});

beforeEach(() => {
  resetMemoryRedis();
});

describe('POST /api/v1/products (create)', () => {
  it('creates a product with defaults applied', async () => {
    const res = await req()
      .post('/api/v1/products')
      .set(ownerHeaders)
      .send({ sku: 'NEW-001', name: 'New Product', price: 750 });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.trackStock).toBe(true);
  });

  it('rejects duplicate SKUs within the store with 409', async () => {
    await createProduct({ sku: 'DUP-001' });
    const res = await req()
      .post('/api/v1/products')
      .set(ownerHeaders)
      .send({ sku: 'DUP-001', name: 'Second', price: 10 });
    expect(res.status).toBe(409);
  });

  it('rejects invalid payloads with 422 field details', async () => {
    const res = await req()
      .post('/api/v1/products')
      .set(ownerHeaders)
      .send({ sku: 'x', name: '', price: -5 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('denies writes to VIEWER role with 403', async () => {
    const res = await req()
      .post('/api/v1/products')
      .set(viewerHeaders)
      .send({ sku: 'VIEWER-1', name: 'Nope', price: 1 });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/products (offset pagination + filters)', () => {
  it('returns pagination metadata and pages without overlap', async () => {
    const p1 = await req().get('/api/v1/products?page=1&pageSize=2').set(ownerHeaders);
    expect(p1.status).toBe(200);
    expect(p1.body.meta.pagination.totalItems).toBeGreaterThanOrEqual(4);
    const p2 = await req().get('/api/v1/products?page=2&pageSize=2').set(ownerHeaders);
    const names = new Set((p1.body.data as ProductRow[]).map((p) => p.id));
    for (const row of p2.body.data as ProductRow[]) {
      expect(names.has(row.id)).toBe(false);
    }
  });

  it('filters by status and price range', async () => {
    const res = await req()
      .get('/api/v1/products?status=DRAFT')
      .set(ownerHeaders);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].sku).toBe('SEED-DRAFT');

    const priced = await req()
      .get('/api/v1/products?minPrice=6000&maxPrice=10000')
      .set(ownerHeaders);
    const skus = (priced.body.data as ProductRow[]).map((p) => p.sku);
    expect(skus).toContain('SEED-RICE');
    expect(skus).not.toContain('SEED-OIL');
  });

  it('searches by q across name and sku', async () => {
    const byName = await req().get('/api/v1/products/search?q=Groundnut').set(ownerHeaders);
    expect(byName.body.data).toHaveLength(1);
    expect(byName.body.data[0].sku).toBe('SEED-OIL');

    const bySku = await req().get('/api/v1/products?q=seed-rice').set(ownerHeaders);
    expect(bySku.body.data).toHaveLength(1);
    expect(bySku.body.data[0].sku).toBe('SEED-RICE');
  });

  it('sorts by price ascending', async () => {
    const res = await req().get('/api/v1/products?sortBy=price&sortOrder=asc&pageSize=50').set(ownerHeaders);
    const prices = (res.body.data as ProductRow[]).map((p) => Number(p.price));
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });

  it('requires q on /search with 422', async () => {
    const res = await req().get('/api/v1/products/search').set(ownerHeaders);
    expect(res.status).toBe(422);
  });
});

describe('tenant isolation', () => {
  it('a product id from another store answers 404', async () => {
    const mine = await createProduct();
    const res = await req()
      .get(`/api/v1/products/${mine.id}`)
      .set('Authorization', `Bearer ${otherStoreToken}`)
      .set('X-Store-Id', storeId);
    expect(res.status).toBe(404);
  });
});

describe('variants sub-resource', () => {
  it('CRUD lifecycle with duplicate SKU guard', async () => {
    const product = await createProduct({ sku: 'VAR-HOST', name: 'T-Shirt', price: 3_000 });
    const created = await req()
      .post(`/api/v1/products/${product.id}/variants`)
      .set(ownerHeaders)
      .send({ sku: 'var-red-m', name: 'Red M', price: 3_200, stockQuantity: 7 });
    expect(created.status).toBe(201);
    expect(created.body.data.sku).toBe('VAR-RED-M');

    const dup = await req()
      .post(`/api/v1/products/${product.id}/variants`)
      .set(ownerHeaders)
      .send({ sku: 'VAR-RED-M', name: 'Dup', stockQuantity: 1 });
    expect(dup.status).toBe(409);

    const updated = await req()
      .put(`/api/v1/products/${product.id}/variants/${created.body.data.id}`)
      .set(ownerHeaders)
      .send({ price: 3_500 });
    expect(Number(updated.body.data.price)).toBe(3_500);

    const removed = await req()
      .delete(`/api/v1/products/${product.id}/variants/${created.body.data.id}`)
      .set(ownerHeaders);
    expect(removed.status).toBe(200);

    const listed = await req().get(`/api/v1/products/${product.id}/variants`).set(ownerHeaders);
    expect(listed.body.data).toHaveLength(0);
  });

  it('variant adjust resyncs the parent product sum', async () => {
    const product = await createProduct({ sku: 'SUM-HOST', name: 'Shoe', trackStock: true });
    const variant = await req()
      .post(`/api/v1/products/${product.id}/variants`)
      .set(ownerHeaders)
      .send({ sku: 'SUM-V1', name: 'Size 42', stockQuantity: 5 })
      .then((r) => r.body.data);
    await req().put(`/api/v1/products/${product.id}/inventory`).set(ownerHeaders).send({
      variantId: variant.id,
      delta: 4,
      reason: 'RESTOCK',
    });
    const fetched = await req().get(`/api/v1/products/${product.id}`).set(ownerHeaders);
    expect(fetched.body.data.stockQuantity).toBe(9);
  });
});

describe('images sub-resource', () => {
  let productId: string;
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

  beforeAll(async () => {
    productId = (await createProduct({ sku: 'IMG-HOST', name: 'Photo Item' })).id;
  });

  it('uploads first image as primary and second as non-primary', async () => {
    const first = await req()
      .post(`/api/v1/products/${productId}/images`)
      .set(ownerHeaders)
      .attach('image', jpeg, { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(first.status).toBe(201);
    expect(first.body.data.isPrimary).toBe(true);

    const second = await req()
      .post(`/api/v1/products/${productId}/images`)
      .set(ownerHeaders)
      .attach('image', jpeg, { filename: 'b.jpg', contentType: 'image/jpeg' });
    expect(second.body.data.isPrimary).toBe(false);
  });

  it('setPrimary demotes siblings exclusively', async () => {
    const list = await req().get(`/api/v1/products/${productId}/images`).set(ownerHeaders);
    const second = (list.body.data as Array<{ id: string; isPrimary: boolean }>)[1];
    await req().post(`/api/v1/products/${productId}/images/${second.id}/primary`).set(ownerHeaders);
    const after = await req().get(`/api/v1/products/${productId}/images`).set(ownerHeaders);
    const primaries = (after.body.data as Array<{ id: string; isPrimary: boolean }>).filter((i) => i.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].id).toBe(second.id);
  });

  it('deleting the primary promotes another image', async () => {
    const list = await req().get(`/api/v1/products/${productId}/images`).set(ownerHeaders);
    const primary = (list.body.data as Array<{ id: string; isPrimary: boolean }>).find((i) => i.isPrimary);
    await req().delete(`/api/v1/products/${productId}/images/${primary?.id}`).set(ownerHeaders);
    const after = await req().get(`/api/v1/products/${productId}/images`).set(ownerHeaders);
    const remaining = after.body.data as Array<{ isPrimary: boolean }>;
    expect(remaining.filter((i) => i.isPrimary)).toHaveLength(1);
  });

  it('rejects empty uploads with 422', async () => {
    const res = await req().post(`/api/v1/products/${productId}/images`).set(ownerHeaders);
    expect(res.status).toBe(422);
  });
});

describe('categories (v2) and tags', () => {
  it('category lifecycle: dup 409, productsCount, detach on delete', async () => {
    const cat = await req()
      .post('/api/v1/product-categories')
      .set(ownerHeaders)
      .send({ name: 'Food Stuff', description: 'Staples' });
    expect(cat.status).toBe(201);

    const dup = await req()
      .post('/api/v1/product-categories')
      .set(ownerHeaders)
      .send({ name: 'Food Stuff' });
    expect(dup.status).toBe(409);

    // Assign a category through the product update endpoint.
    const rice = await req().get('/api/v1/products?q=SEED-RICE').set(ownerHeaders);
    const riceId = rice.body.data[0].id;
    const updated = await req()
      .patch(`/api/v1/products/${riceId}`)
      .set(ownerHeaders)
      .send({ categoryId: cat.body.data.id });
    expect(updated.body.data.categoryId).toBe(cat.body.data.id);

    const list = await req().get('/api/v1/product-categories').set(ownerHeaders);
    const food = (list.body.data as Array<{ id: string; name: string; productsCount: number }>).find(
      (c) => c.name === 'Food Stuff',
    );
    expect(food?.productsCount).toBe(1);

    const del = await req().delete(`/api/v1/product-categories/${cat.body.data.id}`).set(ownerHeaders);
    expect(del.status).toBe(200);
    const detached = await req().get(`/api/v1/products/${riceId}`).set(ownerHeaders);
    expect(detached.body.data.categoryId).toBeNull();
  });

  it('tag replace flow drives filtering and cleanup', async () => {
    const product = await createProduct({ sku: 'TAG-HOST', name: 'Tagged Thing' });
    const put = await req()
      .put(`/api/v1/products/${product.id}/tags`)
      .set(ownerHeaders)
      .send({ tags: ['promo', 'clearance'] });
    expect(put.status).toBe(200);
    expect(put.body.data.tags.map((t: { name: string }) => t.name).sort()).toEqual(['clearance', 'promo']);

    const filtered = await req().get('/api/v1/products?tag=promo').set(ownerHeaders);
    expect((filtered.body.data as ProductRow[]).some((p) => p.id === product.id)).toBe(true);

    // Replacing drops the previous links.
    await req()
      .put(`/api/v1/products/${product.id}/tags`)
      .set(ownerHeaders)
      .send({ tags: ['new-season'] });
    const stillPromo = await req().get('/api/v1/products?tag=promo').set(ownerHeaders);
    expect((stillPromo.body.data as ProductRow[]).some((p) => p.id === product.id)).toBe(false);

    // Deleting a tag removes its links everywhere.
    const tagList = await req().get('/api/v1/product-tags').set(ownerHeaders);
    const newSeason = (tagList.body.data as Array<{ id: string; name: string }>).find(
      (t) => t.name === 'new-season',
    );
    await req().delete(`/api/v1/product-tags/${newSeason?.id}`).set(ownerHeaders);
    const orphanCheck = await req().get(`/api/v1/products/${product.id}`).set(ownerHeaders);
    expect(orphanCheck.status).toBe(200);
  });
});

describe('discounts sub-resource', () => {
  let productId: string;

  beforeAll(async () => {
    productId = (await createProduct({ sku: 'DISC-HOST', name: 'Discounted', price: 10_000 })).id;
  });

  it('caps percentage discounts at 90 with 422', async () => {
    const res = await req()
      .post(`/api/v1/products/${productId}/discounts`)
      .set(ownerHeaders)
      .send({ code: 'TOOBIG', type: 'PERCENTAGE', value: 95 });
    expect(res.status).toBe(422);
  });

  it('creates, applies and computes savings', async () => {
    const created = await req()
      .post(`/api/v1/products/${productId}/discounts`)
      .set(ownerHeaders)
      .send({ code: 'LAUNCH25', type: 'PERCENTAGE', value: 25, label: 'Launch promo' });
    expect(created.status).toBe(201);

    const applied = await req()
      .post(`/api/v1/products/${productId}/discounts/apply`)
      .set(ownerHeaders)
      .send({ code: 'launch25' });
    expect(applied.status).toBe(200);
    expect(applied.body.data.discountedPrice).toBe(7_500);
    expect(applied.body.data.savings).toBe(2_500);
  });

  it('rejects duplicate codes per store with 409', async () => {
    const res = await req()
      .post(`/api/v1/products/${productId}/discounts`)
      .set(ownerHeaders)
      .send({ code: 'LAUNCH25', type: 'FIXED', value: 100 });
    expect(res.status).toBe(409);
  });

  it('inactive codes answer 422 on apply', async () => {
    await req()
      .post(`/api/v1/products/${productId}/discounts`)
      .set(ownerHeaders)
      .send({ code: 'PAUSED', type: 'FIXED', value: 500, active: false });
    const res = await req()
      .post(`/api/v1/products/${productId}/discounts/apply`)
      .set(ownerHeaders)
      .send({ code: 'PAUSED' });
    expect(res.status).toBe(422);
  });

  it('expired windows answer 422 on apply', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    await req()
      .post(`/api/v1/products/${productId}/discounts`)
      .set(ownerHeaders)
      .send({ code: 'OLDIE', type: 'FIXED', value: 500, endsAt: yesterday });
    const res = await req()
      .post(`/api/v1/products/${productId}/discounts/apply`)
      .set(ownerHeaders)
      .send({ code: 'OLDIE' });
    expect(res.status).toBe(422);
  });
});

describe('inventory ledger', () => {
  let productId: string;

  beforeAll(async () => {
    productId = (await createProduct({ sku: 'INV-HOST', name: 'Stocked Item', stockQuantity: 10 })).id;
  });

  it('setQuantity writes a ledger entry with resulting quantity', async () => {
    const res = await req()
      .put(`/api/v1/products/${productId}/inventory`)
      .set(ownerHeaders)
      .send({ setQuantity: 25, reason: 'MANUAL_CORRECTION', note: 'cycle count' });
    expect(res.status).toBe(200);
    expect(res.body.data.quantity).toBe(25);
    expect(res.body.data.entry.resultingQuantity).toBe(25);
  });

  it('delta adjustments floor at zero and record DAMAGE', async () => {
    const res = await req()
      .put(`/api/v1/products/${productId}/inventory`)
      .set(ownerHeaders)
      .send({ delta: -999, reason: 'DAMAGE' });
    expect(res.body.data.quantity).toBe(0);
    const history = await req().get(`/api/v1/products/${productId}/inventory/history`).set(ownerHeaders);
    const reasons = (history.body.data as Array<{ reason: string }>).map((e) => e.reason);
    expect(reasons).toEqual(['DAMAGE', 'MANUAL_CORRECTION']);
  });

  it('flags low stock store-wide', async () => {
    await req().put(`/api/v1/products/${productId}/inventory`).set(ownerHeaders).send({ setQuantity: 2 });
    const res = await req().get('/api/v1/inventory/low-stock').set(ownerHeaders);
    const ids = (res.body.data as Array<{ productId: string }>).map((r) => r.productId);
    expect(ids).toContain(productId);
  });

  it('untracked products accept adjustments as no-op', async () => {
    const untracked = await createProduct({ sku: 'UNTRACKED', name: 'Service', trackStock: false });
    const res = await req()
      .put(`/api/v1/products/${untracked.id}/inventory`)
      .set(ownerHeaders)
      .send({ delta: 5, reason: 'RESTOCK' });
    expect(res.status).toBe(200);
    expect(res.body.data.entry).toBeNull();
  });
});

describe('CSV import/export', () => {
  it('imports rows, upserting by SKU and isolating bad rows', async () => {
    const csv = [
      'name,sku,price,stockquantity,category,tags',
      'Imported Rice,RICE-IMP,7000,15,Food Stuff,bulk;promo',
      'Broken Row,,not-a-price,,',
    ].join('\n');
    const res = await req()
      .post('/api/v1/products/import')
      .set(ownerHeaders)
      .attach('file', Buffer.from(csv, 'utf8'), 'products.csv');
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(1);
    expect(res.body.data.errors).toHaveLength(1);
    expect(res.body.data.errors[0].row).toBe(3);

    // Re-import updates in place instead of duplicating.
    const csv2 = 'name,sku,price\nUpdated Rice,RICE-IMP,7200';
    const again = await req()
      .post('/api/v1/products/import')
      .set(ownerHeaders)
      .attach('file', Buffer.from(csv2, 'utf8'), 'products.csv');
    expect(again.body.data.updated).toBe(1);
    const check = await req().get('/api/v1/products?q=RICE-IMP').set(ownerHeaders);
    expect(check.body.data).toHaveLength(1);
    expect(Number(check.body.data[0].price)).toBe(7_200);
  });

  it('rejects non-CSV uploads with 422', async () => {
    const res = await req()
      .post('/api/v1/products/import')
      .set(ownerHeaders)
      .attach('file', Buffer.from('%PDF-fake'), 'sheet.pdf');
    expect(res.status).toBe(422);
  });

  it('exports CSV with headers and seeded content', async () => {
    const res = await req().get('/api/v1/products/export').set(ownerHeaders);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('name,sku,price');
    expect(res.text).toContain('SEED-RICE');
  });
});

describe('stats, WhatsApp sync and AI enrichment', () => {
  it('summarizes the catalog', async () => {
    const res = await req().get('/api/v1/products/stats').set(ownerHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBeGreaterThanOrEqual(4);
    expect(res.body.data.active).toBeGreaterThanOrEqual(3);
    expect(res.body.data.draft).toBe(1);
    expect(typeof res.body.data.inventoryValue).toBe('number');
    expect(Array.isArray(res.body.data.topCategories)).toBe(true);
  });

  it('reports skipped entries when no WhatsApp channel exists', async () => {
    const res = await req().post('/api/v1/products/sync-whatsapp').set(ownerHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.synced).toBe(0);
    expect(res.body.data.skippedNoWhatsApp).toBeGreaterThan(0);
  });

  it('describes a product via the heuristic fallback', async () => {
    const rice = await req().get('/api/v1/products?q=SEED-RICE').set(ownerHeaders);
    const id = rice.body.data[0].id;
    const res = await req()
      .post(`/api/v1/products/${id}/ai/describe`)
      .set(ownerHeaders)
      .send({ tone: 'promotional', maxLength: 400 });
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('heuristic');
    expect(res.body.data.description).toContain('Rice 5kg');
  });

  it('suggests a price and persists a PENDING suggestion', async () => {
    const oil = await req().get('/api/v1/products?q=SEED-OIL').set(ownerHeaders);
    const id = oil.body.data[0].id;
    const res = await req().post(`/api/v1/products/${id}/ai/price`).set(ownerHeaders);
    expect(res.status).toBe(201);
    expect(res.body.data.currentPrice).toBe(5_200);
    expect(res.body.data.suggestedPrice).toBeGreaterThan(0);
  });

  it('auto-categorizes from keywords', async () => {
    const res = await req().post('/api/v1/products').set(ownerHeaders)
      .send({ sku: 'AI-RICE', name: 'Mama Gold Parboiled Rice 10kg', price: 14_000 });
    const id = res.body.data.id;
    const out = await req().post(`/api/v1/products/${id}/ai/categorize`).set(ownerHeaders);
    expect(out.status).toBe(200);
    expect(out.body.data.categoryName).toBe('Food Stuff');
    const cats = await req().get('/api/v1/product-categories').set(ownerHeaders);
    expect((cats.body.data as Array<{ name: string }>).some((c) => c.name === 'Food Stuff')).toBe(true);
  });
});
