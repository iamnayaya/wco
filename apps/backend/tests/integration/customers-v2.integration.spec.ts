import { createApp } from '../../src/app.js';
import { setupTestServer } from '../helpers/http.js';
import { getInMemoryDb } from '../helpers/prisma-mock.js';
import { resetMemoryRedis } from '../helpers/redis-mock.js';

/**
 * Customer Management v2 - full HTTP stack with the in-memory Prisma double.
 * Covers: CRUD + offset pagination metadata, search/filters/sort, tenant
 * isolation, RBAC (VIEWER denied writes), tags/notes/segments lifecycles,
 * AI auto-segmentation, CSV import/export, and relationship feeds.
 */

jest.mock('../../src/lib/prisma.js', () =>
  require('../helpers/prisma-mock').makePrismaExports(),
);
jest.mock('../../src/lib/redis.js', () => require('../helpers/redis-mock').makeRedisExports());

const app = createApp();
const req = setupTestServer(app);

let ownerHeaders: Record<string, string>;
let viewerHeaders: Record<string, string>;
let storeId: string;
let otherStoreToken = '';

async function signupAndCreateStore(email: string, storeName = 'Main'): Promise<{ token: string; storeId: string }> {
  const signup = await req()
    .post('/api/v1/auth/signup')
    .send({ companyName: `Shop ${email}`, fullName: 'Owner One', email, password: 'Sup3rSecret!' });
  const token = signup.body.data.accessToken as string;
  const store = await req().post('/api/v1/stores').set('Authorization', `Bearer ${token}`).send({ name: storeName, country: 'NG' });
  return { token, storeId: store.body.data.id };
}

beforeAll(async () => {
  const owner = await signupAndCreateStore('owner@crm.test', 'Owner HQ');
  storeId = owner.storeId;
  ownerHeaders = { Authorization: `Bearer ${owner.token}`, 'X-Store-Id': storeId };

  // Invite a VIEWER through the team endpoint to assert RBAC denials.
  await req()
    .post('/api/v1/users')
    .set(ownerHeaders)
    .send({ email: 'viewer@crm.test', fullName: 'View Only', role: 'VIEWER', temporaryPassword: 'Sup3rSecret!' });
  const viewerLogin = await req()
    .post('/api/v1/auth/login')
    .send({ email: 'viewer@crm.test', password: 'Sup3rSecret!' });
  viewerHeaders = { Authorization: `Bearer ${viewerLogin.body.data.accessToken}`, 'X-Store-Id': storeId };

  const other = await signupAndCreateStore('rival@crm.test', 'Rival HQ');
  otherStoreToken = other.token;

  // Seed a small customer base for the primary store.
  const seed = [
    { waPhone: '+2348011111111', name: 'Ada Obi', email: 'ada@x.test', marketingOptIn: true },
    { waPhone: '+2348022222222', name: 'Bola Ade' },
    { waPhone: '+2348033333333', name: 'Chinedu Eze' },
  ];
  for (const c of seed) {
    await req().post('/api/v1/customers').set(ownerHeaders).send(c);
  }
});

beforeEach(() => {
  // Tests share one seeded DB per run; redis rate limits reset per test.
  resetMemoryRedis();
});

describe('POST /api/v1/customers', () => {
  it('creates a customer and normalizes the phone', async () => {
    const res = await req()
      .post('/api/v1/customers')
      .set(ownerHeaders)
      .send({ waPhone: '080 9999 8888', name: 'Delta User' });
    expect(res.status).toBe(201);
    expect(res.body.data.waPhone).toBe('+2348099998888');
    const fetched = await req().get(`/api/v1/customers/${res.body.data.id}`).set(ownerHeaders);
    expect(fetched.body.data.ordersCount ?? 0).toBe(0);
  });

  it('rejects duplicate phones per store with 409', async () => {
    const res = await req()
      .post('/api/v1/customers')
      .set(ownerHeaders)
      .send({ waPhone: '+2348011111111' });
    expect(res.status).toBe(409);
  });

  it('returns 422 with field details for invalid payloads', async () => {
    const res = await req().post('/api/v1/customers').set(ownerHeaders).send({ waPhone: '' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/customers (offset pagination + filters)', () => {
  it('returns page metadata', async () => {
    const res = await req().get('/api/v1/customers?page=1&pageSize=2').set(ownerHeaders);
    expect(res.status).toBe(200);
    expect(res.body.meta.pagination).toMatchObject({ page: 1, pageSize: 2, totalPages: 2 });
    expect(res.body.data).toHaveLength(2);
    const page2 = await req().get('/api/v1/customers?page=2&pageSize=2').set(ownerHeaders);
    // 3 seeded + 1 created above = 4 total; page 2 carries the remaining two.
    expect(page2.body.meta.pagination.totalItems).toBe(4);
    expect(page2.body.data).toHaveLength(2);
    const page1Names = (res.body.data as Array<{ name: string }>).map((c) => c.name);
    for (const row of page2.body.data) {
      expect(page1Names).not.toContain(row.name);
    }
  });

  it('searches by name substring via q', async () => {
    const res = await req().get('/api/v1/customers?q=Ada').set(ownerHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Ada Obi');
  });

  it('filters by tag and marketingOptIn', async () => {
    const list = await req().get('/api/v1/customers').set(ownerHeaders);
    const ada = list.body.data.find((c: { name: string }) => c.name === 'Ada Obi');
    await req().patch(`/api/v1/customers/${ada.id}`).set(ownerHeaders).send({ tags: ['VIP'] });

    const tagged = await req().get('/api/v1/customers?tag=VIP').set(ownerHeaders);
    expect(tagged.status).toBe(200);
    expect(tagged.body.data).toHaveLength(1);
    expect(tagged.body.data[0].id).toBe(ada.id);

    const optedIn = await req().get('/api/v1/customers?marketingOptIn=true').set(ownerHeaders);
    expect(optedIn.body.data).toHaveLength(1);
    expect(optedIn.body.data[0].name).toBe('Ada Obi');
  });

  it('sorts deterministically by a whitelisted column', async () => {
    const sorted = await req()
      .get('/api/v1/customers?sortBy=totalSpent&sortOrder=desc&pageSize=100')
      .set(ownerHeaders);
    expect(sorted.status).toBe(200);
    const total = sorted.body.meta.pagination.totalItems;
    expect(sorted.body.data).toHaveLength(Math.min(total, 100));
  });

  it('isolates tenants - rival store sees none of our customers', async () => {
    const res = await req()
      .get('/api/v1/customers')
      .set('Authorization', `Bearer ${otherStoreToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('denies cross-store reads even with a guessed id (404, not 403)', async () => {
    const list = await req().get('/api/v1/customers').set(ownerHeaders);
    const foreignId = list.body.data[0].id;
    const store2 = await req()
      .post('/api/v1/stores')
      .set('Authorization', `Bearer ${otherStoreToken}`)
      .send({ name: 'Rival', country: 'NG' });
    const res = await req()
      .get(`/api/v1/customers/${foreignId}`)
      .set('Authorization', `Bearer ${otherStoreToken}`)
      .set('X-Store-Id', store2.body.data.id);
    expect(res.status).toBe(404);
  });
});

describe('RBAC on customer mutations', () => {
  it('VIEWER can read but cannot create/update/delete', async () => {
    const read = await req().get('/api/v1/customers').set(viewerHeaders);
    expect(read.status).toBe(200);

    const create = await req().post('/api/v1/customers').set(viewerHeaders).send({ waPhone: '+2348077777777' });
    expect(create.status).toBe(403);

    const list = await req().get('/api/v1/customers').set(ownerHeaders);
    const target = list.body.data[0].id;
    const patch = await req().patch(`/api/v1/customers/${target}`).set(viewerHeaders).send({ name: 'X' });
    expect(patch.status).toBe(403);
    const del = await req().delete(`/api/v1/customers/${target}`).set(viewerHeaders);
    expect(del.status).toBe(403);
  });
});

describe('notes lifecycle', () => {
  let customerId: string;
  beforeAll(async () => {
    const created = await req()
      .post('/api/v1/customers')
      .set(ownerHeaders)
      .send({ waPhone: '+2348055550001', name: 'Note Buyer' });
    customerId = created.body.data.id;
  });

  it('creates, lists pinned-first, updates and deletes notes', async () => {
    const n1 = await req().post(`/api/v1/customers/${customerId}/notes`).set(ownerHeaders)
      .send({ body: 'Prefers evening delivery' });
    expect(n1.status).toBe(201);
    const n2 = await req().post(`/api/v1/customers/${customerId}/notes`).set(ownerHeaders)
      .send({ body: 'Wholesale buyer', pinned: true });
    expect(n2.status).toBe(201);

    const listed = await req().get(`/api/v1/customers/${customerId}/notes`).set(ownerHeaders);
    expect(listed.body.meta?.pagination?.totalItems).toBe(2);
    expect(listed.body.data[0].body).toBe('Wholesale buyer'); // pinned first

    const updated = await req().put(`/api/v1/customers/${customerId}/notes/${n1.body.data.id}`)
      .set(ownerHeaders).send({ body: 'Prefers weekend delivery' });
    expect(updated.body.data.body).toBe('Prefers weekend delivery');

    const del = await req().delete(`/api/v1/customers/${customerId}/notes/${n1.body.data.id}`).set(ownerHeaders);
    expect(del.status).toBe(200);
    const afterDelete = await req().get(`/api/v1/customers/${customerId}/notes`).set(ownerHeaders);
    expect(afterDelete.body.meta.pagination.totalItems).toBe(1);
  });

  it('404s notes of a foreign customer id', async () => {
    const rivalStore = await req()
      .post('/api/v1/stores')
      .set('Authorization', `Bearer ${otherStoreToken}`)
      .send({ name: 'Rival2', country: 'NG' });
    const res = await req()
      .post(`/api/v1/customers/${customerId}/notes`)
      .set('Authorization', `Bearer ${otherStoreToken}`)
      .set('X-Store-Id', rivalStore.body.data.id)
      .send({ body: 'hijack' });
    expect(res.status).toBe(404);
  });
});

describe('tag catalog + assignment sync', () => {
  it('CRUDs tags and mirrors assignments onto customers.tags', async () => {
    const tag = await req().post('/api/v1/customer-tags').set(ownerHeaders)
      .send({ name: 'Wholesale', color: '#00AA00' });
    expect(tag.status).toBe(201);

    const dup = await req().post('/api/v1/customer-tags').set(ownerHeaders).send({ name: 'Wholesale' });
    expect(dup.status).toBe(409);

    const list = await req().get('/api/v1/customers').set(ownerHeaders);
    const customer = list.body.data.find((c: { name: string }) => c.name === 'Chinedu Eze');

    const assigned = await req()
      .post(`/api/v1/customer-tags/${tag.body.data.id}/customers/${customer.id}`)
      .set(ownerHeaders);
    expect(assigned.status).toBe(201);
    expect(assigned.body.data.tags).toContain('Wholesale');

    const filtered = await req().get('/api/v1/customers?tag=Wholesale').set(ownerHeaders);
    expect(filtered.body.data).toHaveLength(1);

    const removed = await req()
      .delete(`/api/v1/customer-tags/${tag.body.data.id}/customers/${customer.id}`)
      .set(ownerHeaders);
    expect(removed.body.data.tags).not.toContain('Wholesale');

    // Deleting the tag strips it from any customers that still hold it.
    await req().post(`/api/v1/customer-tags/${tag.body.data.id}/customers/${customer.id}`).set(ownerHeaders);
    const delTag = await req().delete(`/api/v1/customer-tags/${tag.body.data.id}`).set(ownerHeaders);
    expect(delTag.status).toBe(200);
    const check = await req().get(`/api/v1/customers/${customer.id}`).set(ownerHeaders);
    expect(check.body.data.tags).not.toContain('Wholesale');
  });
});

describe('AI auto-segmentation', () => {
  it('creates system segments and places customers by rule', async () => {
    // Make Ada a VIP: bump her stats directly in the mock db.
    const db = getInMemoryDb();
    const ada = db.customer.find((c) => c.name === 'Ada Obi');
    if (ada) {
      ada.totalSpent = 120000;
      ada.ordersCount = 7;
      ada.lastOrderAt = new Date(Date.now() - 3 * 86_400_000);
    }
    const bola = db.customer.find((c) => c.name === 'Bola Ade');
    if (bola) {
      bola.createdAt = new Date(Date.now() - 100 * 86_400_000);
      bola.ordersCount = 1;
      bola.lastOrderAt = new Date(Date.now() - 120 * 86_400_000);
    }

    const run = await req().post('/api/v1/customer-segments/auto').set(ownerHeaders);
    expect(run.status).toBe(200);
    const names = run.body.data.perSegment.map((s: { name: string }) => s.name);
    expect(names).toEqual(expect.arrayContaining(['VIP', 'NEW', 'DORMANT']));

    const vip = run.body.data.perSegment.find((s: { name: string }) => s.name === 'VIP');
    expect(vip.members).toBeGreaterThanOrEqual(1);

    const segments = await req().get('/api/v1/customer-segments').set(ownerHeaders);
    expect(segments.body.data.length).toBeGreaterThanOrEqual(6);

    // Legacy `segment` column now carries the primary AI bucket.
    const refreshed = await req().get('/api/v1/customers?q=Ada').set(ownerHeaders);
    expect(refreshed.body.data[0].segment).toBe('VIP');

    const dormant = run.body.data.perSegment.find((s: { name: string }) => s.name === 'DORMANT');
    expect(dormant.members).toBeGreaterThanOrEqual(1);
  });

  it('manual segment membership add/remove works and is idempotent', async () => {
    const seg = await req().post('/api/v1/customer-segments').set(ownerHeaders)
      .send({ name: 'Launch List', description: 'Opted-in for launches' });
    expect(seg.status).toBe(201);

    const list = await req().get('/api/v1/customers').set(ownerHeaders);
    const customer = list.body.data[0];

    const add = await req().post(`/api/v1/customer-segments/${seg.body.data.id}/customers/${customer.id}`).set(ownerHeaders);
    expect(add.status).toBe(201);
    const addAgain = await req().post(`/api/v1/customer-segments/${seg.body.data.id}/customers/${customer.id}`).set(ownerHeaders);
    expect(addAgain.status).toBe(201); // idempotent

    const rm = await req().delete(`/api/v1/customer-segments/${seg.body.data.id}/customers/${customer.id}`).set(ownerHeaders);
    expect(rm.status).toBe(200);

    const del = await req().delete(`/api/v1/customer-segments/${seg.body.data.id}`).set(ownerHeaders);
    expect(del.status).toBe(200);
  });
});

describe('CSV import/export', () => {
  it('imports rows, skipping duplicates and reporting bad ones', async () => {
    const csv = [
      'phone,name,email,tags',
      '+2348044443333,Imported One,imp@x.test,VIP;Launch',
      '+2348011111111,Dup Ada,,', // duplicate -> skipped
      'not-a-phone,Bad Row,,', // invalid -> error row
    ].join('\n');

    const res = await req()
      .post('/api/v1/customers/import')
      .set(ownerHeaders)
      .attach('file', Buffer.from(csv, 'utf8'), 'customers.csv');
    expect(res.status).toBe(201);
    expect(res.body.data.created).toBe(1);
    expect(res.body.data.skippedDuplicates).toBe(1);
    expect(res.body.data.errors).toHaveLength(1);
    expect(res.body.data.errors[0].row).toBe(4);
  });

  it('rejects non-CSV uploads with 422', async () => {
    const res = await req()
      .post('/api/v1/customers/import')
      .set(ownerHeaders)
      .attach('file', Buffer.from('%PDF-fake'), 'sheet.pdf');
    expect(res.status).toBe(422);
  });

  it('exports the directory as CSV containing seeded rows', async () => {
    const res = await req().get('/api/v1/customers/export').set(ownerHeaders);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('phone');
    expect(res.text).toContain('+2348011111111');
  });
});

describe('relationship feeds + stats', () => {
  it('orders/messages/stats endpoints respond with stable shapes', async () => {
    const list = await req().get('/api/v1/customers').set(ownerHeaders);
    const customer = list.body.data.find((c: { name: string }) => c.name === 'Ada Obi');

    const orders = await req().get(`/api/v1/customers/${customer.id}/orders`).set(ownerHeaders);
    expect(orders.status).toBe(200);
    expect(Array.isArray(orders.body.data)).toBe(true);

    const messages = await req().get(`/api/v1/customers/${customer.id}/messages`).set(ownerHeaders);
    expect(messages.status).toBe(200);
    expect(Array.isArray(messages.body.data)).toBe(true);

    const stats = await req().get(`/api/v1/customers/${customer.id}/stats`).set(ownerHeaders);
    expect(stats.status).toBe(200);
    expect(stats.body.data).toMatchObject({
      customerId: customer.id,
      totalSpent: 120000,
      ordersCount: 7,
    });
    expect(stats.body.data.avgOrderValue).toBeCloseTo(120000 / 7);
  });

  it('deletes a customer and cascades notes/memberships', async () => {
    const created = await req()
      .post('/api/v1/customers')
      .set(ownerHeaders)
      .send({ waPhone: '+2348066660011', name: 'Doomed Buyer' });
    const id = created.body.data.id;
    await req().post(`/api/v1/customers/${id}/notes`).set(ownerHeaders).send({ body: 'temp' });

    const del = await req().delete(`/api/v1/customers/${id}`).set(ownerHeaders);
    expect(del.status).toBe(200);

    const gone = await req().get(`/api/v1/customers/${id}`).set(ownerHeaders);
    expect(gone.status).toBe(404);

    const db = getInMemoryDb();
    expect(db.customerNote.filter((n) => n.customerId === id)).toHaveLength(0);
  });
});
