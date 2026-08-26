import { createApp } from '../../src/app.js';
import { setupTestServer } from '../helpers/http.js';
import { getInMemoryDb } from '../helpers/prisma-mock.js';
import { resetMemoryRedis } from '../helpers/redis-mock.js';

/**
 * Order Management API - full HTTP stack over the in-memory Prisma double.
 * Covers: checkout money math + stock decrements, idempotency, tenant
 * isolation, the ORDER_TRANSITIONS state machine (incl. the PSP payment
 * guard), offset listing/filters/search/stats, line-item resyncs, notes
 * authorship rules, refund ledger semantics, cancellations + restock,
 * timeline merge, WhatsApp sync, AI heuristics and CSV import/export.
 */

jest.mock('../../src/lib/prisma.js', () =>
  require('../helpers/prisma-mock').makePrismaExports(),
);
jest.mock('../../src/lib/redis.js', () => require('../helpers/redis-mock').makeRedisExports());

const app = createApp();
const req = setupTestServer(app);

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  channel?: string;
  customerId: string;
  subtotal: number | string;
  discount: number | string;
  deliveryFee: number | string;
  total: number | string;
  fraudScore?: number | null;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  items: Array<{ id: string; productId: string; productName: string; sku: string; quantity: number; unitPrice: number | string; note?: string | null }>;
}

let ownerHeaders: Record<string, string>;
let agentHeaders: Record<string, string>;
let agent2Headers: Record<string, string>;
let viewerHeaders: Record<string, string>;
let rivalHeaders: Record<string, string>;
let riceId = '';
let oilId = '';
let adaId = '';

const db = getInMemoryDb();

async function stockOf(productId: string): Promise<number> {
  const res = await req().get(`/api/v1/products/${productId}`).set(ownerHeaders);
  expect(res.status).toBe(200);
  return Number(res.body.data.stockQuantity);
}

async function mkOrder(overrides: Record<string, unknown> = {}): Promise<OrderRow> {
  const res = await req()
    .post('/api/v1/orders')
    .set(ownerHeaders)
    .send({
      customerId: adaId,
      items: [{ productId: riceId, quantity: 1 }],
      ...overrides,
    });
  expect(res.status).toBe(201);
  return res.body.data as OrderRow;
}

async function transition(orderId: string, status: string, headers = ownerHeaders): Promise<{ status: number; body: { data?: OrderRow; error?: { code: string; message: string } } }> {
  const res = await req().put(`/api/v1/orders/${orderId}/status`).set(headers).send({ status });
  return { status: res.status, body: res.body };
}

beforeAll(async () => {
  const signup = await req()
    .post('/api/v1/auth/signup')
    .send({ companyName: 'Order Shop', fullName: 'Owner One', email: 'owner@orders.test', password: 'Sup3rSecret!' });
  const token = signup.body.data.accessToken as string;
  const store = await req().post('/api/v1/stores').set('Authorization', `Bearer ${token}`).send({ name: 'Order HQ', country: 'NG' });
  const storeId = store.body.data.id as string;
  ownerHeaders = { Authorization: `Bearer ${token}`, 'X-Store-Id': storeId };

  const mkUser = async (email: string, role: string): Promise<string> => {
    await req()
      .post('/api/v1/users')
      .set(ownerHeaders)
      .send({ email, fullName: `${role} User`, role, temporaryPassword: 'Sup3rSecret!' });
    const login = await req().post('/api/v1/auth/login').send({ email, password: 'Sup3rSecret!' });
    return login.body.data.accessToken as string;
  };
  agentHeaders = { Authorization: `Bearer ${await mkUser('agent@orders.test', 'AGENT')}`, 'X-Store-Id': storeId };
  agent2Headers = { Authorization: `Bearer ${await mkUser('agent2@orders.test', 'AGENT')}`, 'X-Store-Id': storeId };
  viewerHeaders = { Authorization: `Bearer ${await mkUser('viewer@orders.test', 'VIEWER')}`, 'X-Store-Id': storeId };

  const rival = await req()
    .post('/api/v1/auth/signup')
    .send({ companyName: 'Rival Shop', fullName: 'Rival One', email: 'rival@orders.test', password: 'Sup3rSecret!' });
  const rivalToken = rival.body.data.accessToken as string;
  const rivalStore = await req()
    .post('/api/v1/stores')
    .set('Authorization', `Bearer ${rivalToken}`)
    .send({ name: 'Rival HQ', country: 'NG' });
  rivalHeaders = { Authorization: `Bearer ${rivalToken}`, 'X-Store-Id': rivalStore.body.data.id };

  const mkProduct = async (body: Record<string, unknown>): Promise<string> => {
    const res = await req().post('/api/v1/products').set(ownerHeaders).send(body);
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  };
  riceId = await mkProduct({ sku: 'ORD-RICE', name: 'Rice 5kg', price: 8_500, stockQuantity: 5_000 });
  oilId = await mkProduct({ sku: 'ORD-OIL', name: 'Groundnut Oil', price: 5_200, stockQuantity: 10 });

  const ada = await req()
    .post('/api/v1/customers')
    .set(ownerHeaders)
    .send({ waPhone: '+2348031234567', name: 'Ada Obi' });
  adaId = ada.body.data.id as string;
});

beforeEach(() => {
  resetMemoryRedis();
});

// ---------------------------------------------------------------------------

describe('POST /api/v1/orders (checkout)', () => {
  let orderA: OrderRow;

  it('creates an order with server-side money math and snapshots', async () => {
    const res = await req()
      .post('/api/v1/orders')
      .set(ownerHeaders)
      .send({
        customerId: adaId,
        items: [
          { productId: riceId, quantity: 2 },
          { productId: oilId, quantity: 1 },
        ],
      });
    expect(res.status).toBe(201);
    orderA = res.body.data as OrderRow;
    expect(orderA.status).toBe('PENDING_PAYMENT');
    expect(orderA.channel).toBe('DASHBOARD');
    expect(Number(orderA.subtotal)).toBe(22_200); // 2x8500 + 5200
    expect(Number(orderA.total)).toBe(22_200);
    expect(orderA.items).toHaveLength(2);
    expect(orderA.items[0]?.productName).toBe('Rice 5kg');
    expect(orderA.items[0]?.sku).toBe('ORD-RICE');
    expect(Number(orderA.items[0]?.unitPrice)).toBe(8_500);
    expect(await stockOf(riceId)).toBe(4_998);
    expect(await stockOf(oilId)).toBe(9);
  });

  it('applies discount and delivery fee inside the total', async () => {
    const order = await mkOrder({ items: [{ productId: riceId, quantity: 1 }], discount: 1_000, deliveryFee: 500 });
    expect(Number(order.subtotal)).toBe(8_500);
    expect(Number(order.total)).toBe(8_000); // 8500 - 1000 + 500
  });

  it('auto-creates the buyer from customerPhone', async () => {
    const order = await mkOrder({ customerId: undefined, customerPhone: '+2348022220000' });
    expect(order.customerId).toBeTruthy();
    expect(order.customerId).not.toBe(adaId);
  });

  it('guards oversell with 409 INSUFFICIENT_STOCK', async () => {
    const res = await req()
      .post('/api/v1/orders')
      .set(ownerHeaders)
      .send({ customerId: adaId, items: [{ productId: oilId, quantity: 900 }] });
    expect(res.status).toBe(409);
  });

  it('rejects unknown products with 404 and bad payloads with 422', async () => {
    const ghost = await req()
      .post('/api/v1/orders')
      .set(ownerHeaders)
      .send({ customerId: adaId, items: [{ productId: 'nope', quantity: 1 }] });
    expect(ghost.status).toBe(404);

    const empty = await req()
      .post('/api/v1/orders')
      .set(ownerHeaders)
      .send({ customerId: adaId, items: [] });
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const noBuyer = await req()
      .post('/api/v1/orders')
      .set(ownerHeaders)
      .send({ items: [{ productId: riceId, quantity: 1 }] });
    expect(noBuyer.status).toBe(422);
  });

  it('denies writes to VIEWER with 403', async () => {
    const res = await req()
      .post('/api/v1/orders')
      .set(viewerHeaders)
      .send({ customerId: adaId, items: [{ productId: riceId, quantity: 1 }] });
    expect(res.status).toBe(403);
  });

  it('replays the first response for a repeated Idempotency-Key', async () => {
    const payload = { customerId: adaId, items: [{ productId: riceId, quantity: 1 }] };
    const first = await req().post('/api/v1/orders').set(ownerHeaders).set('Idempotency-Key', 'idem-order-001').send(payload);
    const replay = await req().post('/api/v1/orders').set(ownerHeaders).set('Idempotency-Key', 'idem-order-001').send(payload);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200); // replays are cached snapshots, not new creations
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.data.id).toBe(first.body.data.id);
  });
});

describe('tenant isolation', () => {
  it('a foreign id answers 404, never a leak', async () => {
    const order = await mkOrder();
    const res = await req().get(`/api/v1/orders/${order.id}`).set(rivalHeaders);
    expect([403, 404]).toContain(res.status);
  });
});

describe('PATCH /api/v1/orders/:id (logistics edits)', () => {
  it('updates context fields but never money lines', async () => {
    const order = await mkOrder();
    const res = await req()
      .patch(`/api/v1/orders/${order.id}`)
      .set(ownerHeaders)
      .send({ notes: 'Leave with gateman', deliveryAddress: '12 Allen Ave', deliveryCity: 'Ikeja' });
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBe('Leave with gateman');
    expect(res.body.data.deliveryCity).toBe('Ikeja');

    const denied = await req()
      .patch(`/api/v1/orders/${order.id}`)
      .set(viewerHeaders)
      .send({ notes: 'nope' });
    expect(denied.status).toBe(403);
  });
});

describe('PUT /:id/status (state machine)', () => {
  it('walks PENDING_PAYMENT -> DELIVERED stamping lifecycle timestamps', async () => {
    const order = await mkOrder({ channel: 'WHATSAPP', items: [{ productId: riceId, quantity: 1 }] });
    for (const [target, stamp] of [['PAID', 'paidAt'], ['PROCESSING', null], ['SHIPPED', 'shippedAt'], ['DELIVERED', 'deliveredAt']] as const) {
      const out = await transition(order.id, target);
      expect(out.status).toBe(200);
      expect(out.body.data?.status).toBe(target);
      if (stamp) expect(out.body.data?.[stamp]).toBeTruthy();
    }
    expect((await transition(order.id, 'PAID')).status).toBe(409); // terminal
  });

  it('refuses illegal jumps with 409 and tolerates idempotent repeats', async () => {
    const order = await mkOrder();
    const skip = await transition(order.id, 'SHIPPED');
    expect(skip.status).toBe(409);
    expect(skip.body.error?.code).toBe('CONFLICT');

    const paid = await transition(order.id, 'PAID');
    expect(paid.status).toBe(200);
    const again = await transition(order.id, 'PAID');
    expect(again.status).toBe(200); // idempotent no-op
  });

  it('blocks PAID when the PSP payment explicitly FAILED, unless offline rails', async () => {
    const order = await mkOrder();
    db.payment.push({ id: 'pay-failed-1', orderId: order.id, provider: 'PAYSTACK', status: 'FAILED' });

    const blocked = await transition(order.id, 'PAID');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error?.message).toMatch(/Payment failed/i);

    db.payment = db.payment.filter((p) => p['id'] !== 'pay-failed-1');
    db.payment.push({ id: 'pay-offline-1', orderId: order.id, provider: 'BANK_TRANSFER', status: 'FAILED' });
    const manual = await transition(order.id, 'PAID');
    expect(manual.status).toBe(200); // offline rails are confirmed by humans
  });

  it('cancel restores reserved stock and stamps cancellation metadata', async () => {
    const before = await stockOf(riceId);
    const order = await mkOrder({ items: [{ productId: riceId, quantity: 3 }] });
    expect(await stockOf(riceId)).toBe(before - 3);

    const out = await transition(order.id, 'CANCELLED');
    expect(out.status).toBe(200);
    expect(out.body.data?.cancelledAt).toBeTruthy();
    expect(out.body.data?.cancellationReason).toMatch(/Cancelled by merchant/);
    expect(await stockOf(riceId)).toBe(before);
  });

  it('appends audit rows readable via status-history + current-status', async () => {
    const order = await mkOrder();
    await transition(order.id, 'PAID');
    // Paid money never vanishes through the bare status endpoint - cancelling
    // after payment requires the audited cancellations sub-resource.
    const illegalCancel = await transition(order.id, 'CANCELLED');
    expect(illegalCancel.status).toBe(409);

    const record = await req()
      .post(`/api/v1/orders/${order.id}/cancellations`)
      .set(ownerHeaders)
      .send({ reason: 'Duplicate placement by buyer' });
    expect(record.status).toBe(201);

    const history = await req().get(`/api/v1/orders/${order.id}/status-history`).set(ownerHeaders);
    expect(history.status).toBe(200);
    const rows = history.body.data as Array<{ fromStatus: string; toStatus: string; actorId: string | null }>;
    expect(rows.map((r) => r.toStatus)).toEqual(['PAID', 'CANCELLED']);
    expect(rows[0]?.actorId).toBeTruthy();

    const current = await req().get(`/api/v1/orders/${order.id}/current-status`).set(ownerHeaders);
    expect(current.body.data.status).toBe('CANCELLED');
    expect(current.body.data.since).toBeTruthy();
  });
});

describe('GET /v2 + /search (offset listing)', () => {
  it('returns pagination metadata and disjoint pages', async () => {
    const p1 = await req().get('/api/v1/orders/v2?page=1&pageSize=2').set(ownerHeaders);
    expect(p1.status).toBe(200);
    expect(p1.body.meta.pagination.page).toBe(1);
    expect(p1.body.meta.pagination.totalItems).toBeGreaterThanOrEqual(3);
    const p2 = await req().get('/api/v1/orders/v2?page=2&pageSize=2').set(ownerHeaders);
    const seen = new Set((p1.body.data as OrderRow[]).map((o) => o.id));
    for (const row of p2.body.data as OrderRow[]) expect(seen.has(row.id)).toBe(false);
  });

  it('filters by status, channel, totals and dates', async () => {
    const pending = await req().get('/api/v1/orders/v2?status=PENDING_PAYMENT').set(ownerHeaders);
    for (const row of pending.body.data as OrderRow[]) expect(row.status).toBe('PENDING_PAYMENT');

    const whatsapp = await req().get('/api/v1/orders/v2?channel=WHATSAPP').set(ownerHeaders);
    expect((whatsapp.body.data as OrderRow[]).length).toBeGreaterThanOrEqual(1);

    const cheap = await req().get('/api/v1/orders/v2?maxTotal=9000').set(ownerHeaders);
    for (const row of cheap.body.data as OrderRow[]) expect(Number(row.total)).toBeLessThanOrEqual(9_000);

    const none = await req().get('/api/v1/orders/v2?dateFrom=2030-01-01').set(ownerHeaders);
    expect(none.body.data).toHaveLength(0);
  });

  it('sorts by total ascending', async () => {
    const res = await req().get('/api/v1/orders/v2?sortBy=total&sortOrder=asc&pageSize=50').set(ownerHeaders);
    const totals = (res.body.data as OrderRow[]).map((o) => Number(o.total));
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  it('searches by order number, customer name and phone digits; decorates buyers', async () => {
    const order = await mkOrder();
    const byNumber = await req().get(`/api/v1/orders/v2?q=${order.orderNumber.slice(-6)}`).set(ownerHeaders);
    expect((byNumber.body.data as OrderRow[]).some((o) => o.id === order.id)).toBe(true);

    const byName = await req().get('/api/v1/orders/v2?q=ada').set(ownerHeaders);
    expect((byName.body.data as OrderRow[]).length).toBeGreaterThanOrEqual(1);
    const decorated = (byName.body.data as Array<OrderRow & { customer?: { name?: string } }>)[0];
    expect(decorated.customer?.name).toContain('Ada');

    const byPhone = await req().get('/api/v1/orders/v2?q=8031234567').set(ownerHeaders);
    expect((byPhone.body.data as OrderRow[]).length).toBeGreaterThanOrEqual(1);

    const alias = await req().get('/api/v1/orders/search?q=8031234567').set(ownerHeaders);
    expect(alias.status).toBe(200);
  });

  it('keeps the legacy cursor contract alive on GET /', async () => {
    const res = await req().get('/api/v1/orders?status=PENDING_PAYMENT&limit=5').set(ownerHeaders);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.meta.pagination.nextCursor).toBeNull();
  });
});

describe('GET /stats (dashboard rollup)', () => {
  it('summarizes counts, revenue and rates', async () => {
    const res = await req().get('/api/v1/orders/stats').set(ownerHeaders);
    expect(res.status).toBe(200);
    const stats = res.body.data;
    expect(stats.total).toBeGreaterThanOrEqual(5);
    expect(stats.byStatus.PENDING_PAYMENT).toBeGreaterThanOrEqual(1);
    expect(stats.revenue).toBeGreaterThan(0);
    expect(stats.avgOrderValue).toBeGreaterThan(0);
    expect(stats.todayCount).toBeGreaterThanOrEqual(1);
    expect(stats.cancelRate).toBeGreaterThan(0);
    expect(stats.fulfilmentRate).toBeGreaterThanOrEqual(0);
  });
});

describe('line items sub-resource', () => {
  it('lists and fetches single lines with snapshots', async () => {
    const order = await mkOrder({ items: [{ productId: riceId, quantity: 2 }, { productId: oilId, quantity: 1 }] });
    const list = await req().get(`/api/v1/orders/${order.id}/items`).set(ownerHeaders);
    expect(list.body.data).toHaveLength(2);
    const itemId = (list.body.data as Array<{ id: string }>)[0]?.id ?? "";

    const single = await req().get(`/api/v1/orders/${order.id}/items/${itemId}`).set(ownerHeaders);
    expect(single.body.data.id).toBe(itemId);
  });

  it('quantity updates resync totals and rebalance stock atomically', async () => {
    const before = await stockOf(riceId);
    const order = await mkOrder({ items: [{ productId: riceId, quantity: 2 }, { productId: oilId, quantity: 1 }] });
    const itemId = order.items.find((i) => i.productId === riceId)?.id as string;

    const raised = await req()
      .put(`/api/v1/orders/${order.id}/items/${itemId}`)
      .set(ownerHeaders)
      .send({ quantity: 4, note: 'extra sachet' });
    expect(raised.status).toBe(200);
    // The mutation returns the resynchronized order.
    expect(Number(raised.body.data.total)).toBe(4 * 8_500 + 5_200);
    expect(await stockOf(riceId)).toBe(before - 4);

    const items = await req().get(`/api/v1/orders/${order.id}/items`).set(ownerHeaders);
    const line = (items.body.data as Array<{ id: string; quantity: number; note: string | null }>).find(
      (i) => i.id === itemId,
    );
    expect(line?.quantity).toBe(4);
    expect(line?.note).toBe('extra sachet');
  });

  it('refuses raises beyond available stock with 409 and leaves totals intact', async () => {
    const order = await mkOrder({ items: [{ productId: oilId, quantity: 1 }] });
    const itemId = order.items[0]?.id ?? "";
    const before = await req().get(`/api/v1/orders/${order.id}`).set(ownerHeaders);
    const raise = await req()
      .put(`/api/v1/orders/${order.id}/items/${itemId}`)
      .set(ownerHeaders)
      .send({ quantity: 99 });
    expect(raise.status).toBe(409);
    const after = await req().get(`/api/v1/orders/${order.id}`).set(ownerHeaders);
    expect(Number(after.body.data.total)).toBe(Number(before.body.data.total));
  });

  it('deleting a line restores its units and recalculates the bill', async () => {
    const before = await stockOf(riceId);
    const order = await mkOrder({ items: [{ productId: riceId, quantity: 2 }, { productId: oilId, quantity: 1 }] });
    const riceItem = order.items.find((i) => i.productId === riceId)?.id as string;

    const del = await req().delete(`/api/v1/orders/${order.id}/items/${riceItem}`).set(ownerHeaders);
    expect(del.status).toBe(200);
    // The mutation answers with the resynchronized order.
    expect(Number(del.body.data.total)).toBe(5_200); // only the oil line survives
    expect(await stockOf(riceId)).toBe(before);

    const remaining = await req().get(`/api/v1/orders/${order.id}/items`).set(ownerHeaders);
    expect(remaining.body.data).toHaveLength(1);
    expect((remaining.body.data as Array<{ productId: string }>)[0]?.productId).toBe(oilId);
  });

  it('never strands an order without lines', async () => {
    const order = await mkOrder();
    const itemId = order.items[0]?.id ?? "";
    const del = await req().delete(`/api/v1/orders/${order.id}/items/${itemId}`).set(ownerHeaders);
    expect(del.status).toBe(404);
    expect(del.body.error.message).toMatch(/last item/i);
  });
});

describe('order notes', () => {
  it('creates, sorts pinned-first, and enforces authorship on edits', async () => {
    const order = await mkOrder();
    const mine = await req()
      .post(`/api/v1/orders/${order.id}/notes`)
      .set(agentHeaders)
      .send({ body: 'Customer called - deliver after 5pm', pinned: true });
    expect(mine.status).toBe(201);
    expect(mine.body.data.pinned).toBe(true);
    expect(mine.body.data.authorId).toBeTruthy();

    await req().post(`/api/v1/orders/${order.id}/notes`).set(agent2Headers).send({ body: 'Regular note' });

    const list = await req().get(`/api/v1/orders/${order.id}/notes`).set(viewerHeaders);
    expect(list.status).toBe(200);
    const notes = list.body.data as Array<{ id: string; pinned: boolean; body: string }>;
    expect(notes).toHaveLength(2);
    expect(notes[0]?.pinned).toBe(true);

    const foreignEdit = await req()
      .put(`/api/v1/orders/${order.id}/notes/${mine.body.data.id}`)
      .set(agent2Headers)
      .send({ body: 'hijack' });
    expect(foreignEdit.status).toBe(403);

    const authorEdit = await req()
      .put(`/api/v1/orders/${order.id}/notes/${mine.body.data.id}`)
      .set(agentHeaders)
      .send({ pinned: false });
    expect(authorEdit.status).toBe(200);

    const managerEdit = await req()
      .put(`/api/v1/orders/${order.id}/notes/${mine.body.data.id}`)
      .set(ownerHeaders)
      .send({ body: 'Manager corrected this' });
    expect(managerEdit.status).toBe(200); // managers may edit any note

    const del = await req().delete(`/api/v1/orders/${order.id}/notes/${mine.body.data.id}`).set(agentHeaders);
    expect(del.body.data.deleted).toBe(true);
  });

  it('validates note bodies and read access stays open to the team', async () => {
    const order = await mkOrder();
    const bad = await req().post(`/api/v1/orders/${order.id}/notes`).set(agentHeaders).send({ body: '' });
    expect(bad.status).toBe(422);
    const read = await req().get(`/api/v1/orders/${order.id}/notes`).set(viewerHeaders);
    expect(read.status).toBe(200);
  });
});

describe('refund ledger', () => {
  it('is OWNER/ADMIN territory - AGENT gets 403', async () => {
    const order = await mkOrder();
    await transition(order.id, 'PAID');
    const res = await req()
      .post(`/api/v1/orders/${order.id}/refunds`)
      .set(agentHeaders)
      .send({ amount: 100, reason: 'agent attempt' });
    expect(res.status).toBe(403);
  });

  it('refuses unpaid orders and over-balances with precise errors', async () => {
    const unpaid = await mkOrder();
    const early = await req()
      .post(`/api/v1/orders/${unpaid.id}/refunds`)
      .set(ownerHeaders)
      .send({ amount: 100 });
    expect(early.status).toBe(409);

    const paid = await mkOrder({ items: [{ productId: riceId, quantity: 5 }], deliveryFee: 500 });
    await transition(paid.id, 'PAID'); // total 43,000
    const greedy = await req()
      .post(`/api/v1/orders/${paid.id}/refunds`)
      .set(ownerHeaders)
      .send({ amount: 50_000 });
    expect(greedy.status).toBe(422);
    expect(greedy.body.error.message).toMatch(/exceeds refundable balance/i);
  });

  it('partial refunds succeed without touching the order status', async () => {
    const order = await mkOrder({ items: [{ productId: riceId, quantity: 5 }] });
    await transition(order.id, 'PAID'); // total 42,500

    const created = await req()
      .post(`/api/v1/orders/${order.id}/refunds`)
      .set(ownerHeaders)
      .send({ amount: 20_000, reason: 'damaged bag' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('PENDING');

    const processed = await req()
      .post(`/api/v1/orders/${order.id}/refunds/${created.body.data.id}/process`)
      .set(ownerHeaders);
    expect(processed.status).toBe(200);
    expect(processed.body.data.refund.status).toBe('SUCCEEDED');
    expect(String(processed.body.data.refund.providerReference)).toMatch(/^rfnd_/);
    expect(processed.body.data.orderRefunded).toBe(false);
    expect(processed.body.data.order.status).toBe('PAID');

    // Ledger accounting: succeeded refunds count against the balance.
    const greedy = await req()
      .post(`/api/v1/orders/${order.id}/refunds`)
      .set(ownerHeaders)
      .send({ amount: 22_501 });
    expect(greedy.status).toBe(422);

    const reprocess = await req()
      .post(`/api/v1/orders/${order.id}/refunds/${created.body.data.id}/process`)
      .set(ownerHeaders);
    expect(reprocess.status).toBe(409); // SUCCEEDED is immutable
  });

  it('full coverage drives the order to REFUNDED with an audit row', async () => {
    const order = await mkOrder({ items: [{ productId: riceId, quantity: 2 }], deliveryFee: 1_000 }); // 18,000
    await transition(order.id, 'PAID');

    const rest = await req()
      .post(`/api/v1/orders/${order.id}/refunds`)
      .set(ownerHeaders)
      .send({ amount: 18_000 });
    const done = await req()
      .post(`/api/v1/orders/${order.id}/refunds/${rest.body.data.id}/process`)
      .set(ownerHeaders);
    expect(done.body.data.orderRefunded).toBe(true);
    expect(done.body.data.order.status).toBe('REFUNDED');

    const history = await req().get(`/api/v1/orders/${order.id}/status-history`).set(ownerHeaders);
    const refunded = (history.body.data as Array<{ toStatus: string; reason: string | null }>).find(
      (r) => r.toStatus === 'REFUNDED',
    );
    expect(refunded?.reason).toMatch(/Full refund/);
  });

  it('provider failures land the refund in FAILED and leave the order paid', async () => {
    const order = await mkOrder();
    await transition(order.id, 'PAID');
    const refund = await req()
      .post(`/api/v1/orders/${order.id}/refunds`)
      .set(ownerHeaders)
      .send({ amount: 500 });

    process.env.PAYMENT_REFUND_PUSH = 'fail';
    try {
      const out = await req()
        .post(`/api/v1/orders/${order.id}/refunds/${refund.body.data.id}/process`)
        .set(ownerHeaders);
      expect(out.status).toBe(200);
      expect(out.body.data.refund.status).toBe('FAILED');
      expect(out.body.data.order.status).toBe('PAID');
    } finally {
      delete process.env.PAYMENT_REFUND_PUSH;
    }
  });

  it('supports PENDING-only edits and deletes', async () => {
    const order = await mkOrder();
    await transition(order.id, 'PAID');
    const refund = await req()
      .post(`/api/v1/orders/${order.id}/refunds`)
      .set(ownerHeaders)
      .send({ amount: 100 });

    const edited = await req()
      .put(`/api/v1/orders/${order.id}/refunds/${refund.body.data.id}`)
      .set(ownerHeaders)
      .send({ amount: 150, reason: 'corrected' });
    expect(edited.status).toBe(200);
    expect(Number(edited.body.data.amount)).toBe(150);

    const removed = await req()
      .delete(`/api/v1/orders/${order.id}/refunds/${refund.body.data.id}`)
      .set(ownerHeaders);
    expect(removed.body.data.deleted).toBe(true);
  });
});

describe('cancellations', () => {
  it('guards delivered orders toward refunds instead', async () => {
    const order = await mkOrder();
    for (const step of ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED']) {
      await transition(order.id, step);
    }
    const res = await req()
      .post(`/api/v1/orders/${order.id}/cancellations`)
      .set(ownerHeaders)
      .send({ reason: 'changed my mind' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/refund instead/i);
  });

  it('creates a record, cancels the order, and blocks duplicates', async () => {
    const before = await stockOf(riceId);
    const order = await mkOrder({ items: [{ productId: riceId, quantity: 2 }] });

    const created = await req()
      .post(`/api/v1/orders/${order.id}/cancellations`)
      .set(ownerHeaders)
      .send({ reason: 'Duplicate placement by buyer' });
    expect(created.status).toBe(201);
    expect(created.body.data.cancellation.restocked).toBe(false);
    expect(created.body.data.order.status).toBe('CANCELLED');
    expect(created.body.data.order.cancellationReason).toBe('Duplicate placement by buyer');

    const dup = await req()
      .post(`/api/v1/orders/${order.id}/cancellations`)
      .set(ownerHeaders)
      .send({ reason: 'again' });
    expect(dup.status).toBe(409);

    const processed = await req()
      .post(`/api/v1/orders/${order.id}/cancellations/${created.body.data.cancellation.id}/process`)
      .set(ownerHeaders);
    expect(processed.status).toBe(200);
    expect(processed.body.data.restocked).toBe(true);
    expect(await stockOf(riceId)).toBe(before);

    const patched = await req()
      .patch(`/api/v1/orders/${order.id}/cancellations/${created.body.data.cancellation.id}`)
      .set(ownerHeaders)
      .send({ reason: 'Buyer requested cancellation in writing' });
    expect(patched.body.data.reason).toMatch(/writing/);
  });

  it('is OWNER/ADMIN territory and deletable while recorded', async () => {
    const order = await mkOrder();
    const agentTry = await req()
      .post(`/api/v1/orders/${order.id}/cancellations`)
      .set(agentHeaders)
      .send({ reason: 'not allowed' });
    expect(agentTry.status).toBe(403);

    const created = await req()
      .post(`/api/v1/orders/${order.id}/cancellations`)
      .set(ownerHeaders)
      .send({ reason: 'Stock arrived damaged' });
    const del = await req()
      .delete(`/api/v1/orders/${order.id}/cancellations/${created.body.data.cancellation.id}`)
      .set(ownerHeaders);
    expect(del.body.data.deleted).toBe(true);
  });
});

describe('GET /:id/timeline (merged feed)', () => {
  it('merges status moves, notes and refunds oldest-first', async () => {
    const order = await mkOrder({ items: [{ productId: riceId, quantity: 2 }] });
    await transition(order.id, 'PAID');
    await req().post(`/api/v1/orders/${order.id}/notes`).set(agentHeaders).send({ body: 'Priority dispatch' });
    const refund = await req()
      .post(`/api/v1/orders/${order.id}/refunds`)
      .set(ownerHeaders)
      .send({ amount: 1_000 });
    await req().post(`/api/v1/orders/${order.id}/refunds/${refund.body.data.id}/process`).set(ownerHeaders);

    const res = await req().get(`/api/v1/orders/${order.id}/timeline`).set(viewerHeaders);
    expect(res.status).toBe(200);
    const feed = res.body.data;
    expect(feed.itemCount).toBe(1);
    expect(Number(feed.order.total)).toBe(17_000);
    const types = (feed.events as Array<{ type: string; at: string }>).map((e) => e.type);
    expect(types).toEqual(['status', 'note', 'refund']);

    const times = (feed.events as Array<{ at: string }>).map((e) => new Date(e.at).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe('WhatsApp sync', () => {
  it('queues open orders and reports skips', async () => {
    const res = await req().post('/api/v1/orders/sync-whatsapp').set(ownerHeaders);
    expect(res.status).toBe(200);
    const summary = res.body.data;
    expect(summary.queued).toBeGreaterThanOrEqual(1);
    expect(summary.skippedNoWhatsApp).toBeGreaterThanOrEqual(0);
    expect(summary.failed).toBe(0);
  });

  it('counts provider failures through the transport seam', async () => {
    process.env.WHATSAPP_ORDER_PUSH = 'fail';
    try {
      const res = await req().post('/api/v1/orders/sync-whatsapp').set(ownerHeaders);
      expect(res.body.data.failed).toBeGreaterThanOrEqual(1);
      expect(res.body.data.queued).toBe(0);
    } finally {
      delete process.env.WHATSAPP_ORDER_PUSH;
    }
  });
});

describe('AI endpoints (heuristic mode)', () => {
  it('predicts fulfillment with explainable basis', async () => {
    const order = await mkOrder({ items: [{ productId: riceId, quantity: 2 }, { productId: oilId, quantity: 1 }], deliveryAddress: '12 Allen Ave', deliveryCity: 'Lagos' });
    const res = await req().post(`/api/v1/orders/${order.id}/ai/predict-fulfillment`).set(ownerHeaders);
    expect(res.status).toBe(200);
    const out = res.body.data;
    expect(out.orderId).toBe(order.id);
    expect(out.predictedMinutes).toBeGreaterThanOrEqual(50);
    expect(out.confidence).toBeLessThanOrEqual(0.85);
    expect(out.basis.some((b: { label: string }) => b.label === 'Base handling')).toBe(true);
  });

  it('flags high-risk orders HIGH and persists the score', async () => {
    const order = await mkOrder({
      customerPhone: '+2348099988777',
      items: [{ productId: riceId, quantity: 12 }], // round 102k total - fires every value signal
    });
    const res = await req().post(`/api/v1/orders/${order.id}/ai/fraud-check`).set(ownerHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.level).toBe('HIGH');
    expect(res.body.data.riskScore).toBeGreaterThanOrEqual(70);
    expect(res.body.data.signals.length).toBeGreaterThanOrEqual(2);

    const refreshed = await req().get(`/api/v1/orders/${order.id}`).set(ownerHeaders);
    expect(Number(refreshed.body.data.fraudScore)).toBeGreaterThanOrEqual(70);
  });
});

describe('CSV export + import', () => {
  it('exports orders with the documented header and rows', async () => {
    const res = await req().get('/api/v1/orders/export').set(ownerHeaders);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const text = res.text.replace(/^\uFEFF/, ''); // Excel BOM
    expect(text.startsWith('orderNumber,status,customerName,customerPhone,items,')).toBe(true);
    expect(text.split(/\r?\n/).filter(Boolean).length).toBeGreaterThanOrEqual(3);
  });

  it('imports good rows through checkout and isolates bad ones', async () => {
    const csv = [
      'customerphone,items,discount,deliveryfee,address,city',
      '+2348077776666,ORD-RICE:2,,500,12 Allen Ave,Lagos',
      ',ORD-RICE:1',
      '+2348077776666,GHOST:3',
    ].join('\n');

    const res = await req()
      .post('/api/v1/orders/import')
      .set(ownerHeaders)
      .attach('file', Buffer.from(csv), { filename: 'orders.csv', contentType: 'text/csv' });
    expect(res.status).toBe(201);
    const report = res.body.data;
    expect(report.created).toBe(1);
    expect(report.failedRows).toHaveLength(2);
    expect(report.failedRows.map((f: { row: number }) => f.row).sort()).toEqual([3, 4]);
    expect(report.failedRows.some((f: { error: string }) => f.error.includes("customerPhone is required"))).toBe(true);
    expect(report.failedRows.some((f: { error: string }) => f.error.includes("Unknown SKU"))).toBe(true);

    const found = await req().get('/api/v1/orders/v2?q=8077776666').set(ownerHeaders);
    expect(found.body.data).toHaveLength(1);
    expect(Number((found.body.data as OrderRow[])[0]?.total)).toBe(17_500); // 2x8500 + 500 fee
  });

  it('rejects missing files and wrong mime types with 422', async () => {
    const noFile = await req().post('/api/v1/orders/import').set(ownerHeaders);
    expect(noFile.status).toBe(422);

    const badMime = await req()
      .post('/api/v1/orders/import')
      .set(ownerHeaders)
      .attach('file', Buffer.from('customerphone,items\n081,RICE:1'), { filename: 'orders.txt', contentType: 'text/plain' });
    expect(badMime.status).toBe(422);
    expect(badMime.body.error.message).toMatch(/CSV uploads/i);
  });
});
