import { createApp } from '../../src/app.js';
import { setupTestServer } from '../helpers/http.js';
import { getInMemoryDb } from '../helpers/prisma-mock.js';
import { resetMemoryRedis } from '../helpers/redis-mock.js';

/**
 * Message Management API v2 - full HTTP stack over the in-memory Prisma double.
 * Covers: WhatsApp connection lifecycle, the signed Meta webhook ingress
 * (handshake, flattening, dedupe), the inline AI responder turn pipeline
 * (grounding, canned replies, escalation gates, AiResponseLog telemetry),
 * thread/message CRUD with cursor feeds and CSV export, attachments limits,
 * AI config/intent endpoints and RBAC + tenant isolation.
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

// The responder reads this at call time - inline mode makes webhook turns synchronous.
process.env.AI_PROCESSING_MODE = 'inline';
// This integration spec makes hundreds of requests — raise the default 100/min ceiling.
process.env.RATE_LIMIT_MAX_REQUESTS = '9999';

const app = createApp();
const req = setupTestServer(app);

const db = getInMemoryDb();

interface ThreadRow {
  id: string;
  status: string;
  botEnabled: boolean;
  customerId: string;
  unreadCount: number;
  lastMessageAt?: string;
  customer?: { id: string; name: string; waPhone: string };
}

interface MessageRow {
  id: string;
  conversationId: string;
  direction: string;
  type: string;
  body: string | null;
  status: string;
  sentByBot: boolean;
  waMessageId: string | null;
  createdAt?: string;
}

let ownerHeaders: Record<string, string>;
let agentHeaders: Record<string, string>;
let viewerHeaders: Record<string, string>;
let rivalHeaders: Record<string, string>;
let storeId = '';
const phoneNumberId = 'PNID-777';

/** Builds a Meta-shaped webhook body for one text message. */
function metaBody(waMessageId: string, fromPhone: string, text: string, pnid = phoneNumberId): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '2348000000000', phone_number_id: pnid },
              contacts: [{ profile: { name: 'Contact' }, wa_id: fromPhone.replace(/^\+/, '') }],
              messages: [
                {
                  id: waMessageId,
                  from: fromPhone.replace(/^\+/, ''),
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

async function postWebhook(body: string): Promise<{ status: number; text: string }> {
  const res = await req()
    .post('/api/v1/webhooks/inbound/whatsapp')
    .set('Content-Type', 'application/json')
    .send(body);
  return { status: res.status, text: typeof res.text === 'string' ? res.text : '' };
}

function messagesOf(threadId: string): MessageRow[] {
  return (db.message as Array<Record<string, unknown>>)
    .filter((m) => m.conversationId === threadId)
    .map((m) => m as unknown as MessageRow);
}

async function threadForPhone(waPhone: string): Promise<ThreadRow> {
  const threads = await req().get('/api/v1/message-threads').set(ownerHeaders);
  expect(threads.status).toBe(200);
  const mine = (threads.body.data as ThreadRow[]).find((t) => t.customer?.waPhone === waPhone);
  expect(mine).toBeDefined();
  return mine as ThreadRow;
}

beforeAll(async () => {
  resetMemoryRedis();

  const signup = await req()
    .post('/api/v1/auth/signup')
    .send({ companyName: 'Chat Shop', fullName: 'Owner Two', email: 'owner@messages.test', password: 'Sup3rSecret!' });
  const token = signup.body.data.accessToken as string;
  const store = await req()
    .post('/api/v1/stores').set('Authorization', `Bearer ${token}`)
    .send({ name: 'Chat HQ', country: 'NG' });
  storeId = store.body.data.id as string;
  ownerHeaders = { Authorization: `Bearer ${token}`, 'X-Store-Id': storeId };

  const mkUser = async (email: string, role: string): Promise<Record<string, string>> => {
    await req()
      .post('/api/v1/users').set(ownerHeaders)
      .send({ email, fullName: `${role} User`, role, temporaryPassword: 'Sup3rSecret!' });
    const login = await req().post('/api/v1/auth/login').send({ email, password: 'Sup3rSecret!' });
    return { Authorization: `Bearer ${login.body.data.accessToken as string}`, 'X-Store-Id': storeId };
  };
  agentHeaders = await mkUser('agent@messages.test', 'AGENT');
  viewerHeaders = await mkUser('viewer@messages.test', 'VIEWER');

  const rival = await req()
    .post('/api/v1/auth/signup')
    .send({ companyName: 'Rival Chat', fullName: 'Rival Two', email: 'rival@messages.test', password: 'Sup3rSecret!' });
  const rivalToken = rival.body.data.accessToken as string;
  const rivalStore = await req()
    .post('/api/v1/stores').set('Authorization', `Bearer ${rivalToken}`)
    .send({ name: 'Rival Chat HQ', country: 'NG' });
  rivalHeaders = { Authorization: `Bearer ${rivalToken}`, 'X-Store-Id': rivalStore.body.data.id };

  // Catalog for reply grounding.
  const rice = await req()
    .post('/api/v1/products').set(ownerHeaders)
    .send({ sku: 'MSG-RICE', name: 'Rice 5kg', price: 8500, stockQuantity: 100 });
  expect(rice.status).toBe(201);

  // WhatsApp number connected + verified so webhook routing resolves the store.
  const connect = await req()
    .post('/api/v1/whatsapp/connect').set(ownerHeaders)
    .send({ phone: '+2348001112223', displayName: 'Chat HQ Store' });
  expect(connect.status).toBe(201);
  const verify = await req().post('/api/v1/whatsapp/verify').set(ownerHeaders).send({ phoneNumberId });
  expect(verify.status).toBe(200);

  // Turn the bot on.
  const cfg = await req().put('/api/v1/ai-configurations').set(ownerHeaders).send({ isEnabled: true });
  expect(cfg.status).toBe(200);
});

// ---------------------------------------------------------------------------
// WhatsApp connection lifecycle
// ---------------------------------------------------------------------------

describe('WhatsApp connection', () => {
  it('reports CONNECTED after verify and exposes status', async () => {
    const conn = await req().get('/api/v1/whatsapp/connection').set(ownerHeaders);
    expect(conn.status).toBe(200);
    expect(conn.body.data).toMatchObject({ status: 'CONNECTED', phoneNumberId });

    const status = await req().get('/api/v1/whatsapp/status').set(ownerHeaders);
    expect(status.body.data.connected).toBe(true);
  });

  it('re-connecting updates the single row instead of duplicating', async () => {
    const again = await req().post('/api/v1/whatsapp/connect').set(ownerHeaders).send({ phone: '+2348001112224' });
    expect(again.status).toBe(201);
    const rows = db.whatsappConnection.filter((c) => c.storeId === storeId);
    expect(rows).toHaveLength(1);

    // Restore verified state.
    await req().post('/api/v1/whatsapp/verify').set(ownerHeaders).send({ phoneNumberId });
  });

  it('guards mutations behind store:write and isolates tenants', async () => {
    const denied = await req().post('/api/v1/whatsapp/connect').set(viewerHeaders).send({ phone: '+2348009990001' });
    expect([400, 401, 403]).toContain(denied.status);
    const rivalConn = await req().get('/api/v1/whatsapp/connection').set(rivalHeaders);
    expect(rivalConn.body.data ?? null).toBeFalsy();
  });

  it('disconnects and clears Meta routing, then restores', async () => {
    const off = await req().delete('/api/v1/whatsapp/disconnect').set(ownerHeaders);
    expect(off.status).toBe(200);
    expect(off.body.data.status).toBe('DISCONNECTED');
    const storeRow = db.store.find((s) => s.id === storeId) as Record<string, unknown> | undefined;
    expect(storeRow?.whatsappNameId ?? null).toBeNull();

    await req().post('/api/v1/whatsapp/connect').set(ownerHeaders).send({ phone: '+2348001112223' });
    await req().post('/api/v1/whatsapp/verify').set(ownerHeaders).send({ phoneNumberId });
    const status = await req().get('/api/v1/whatsapp/status').set(ownerHeaders);
    expect(status.body.data.connected).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Webhook handshake
// ---------------------------------------------------------------------------

describe('Meta webhook handshake', () => {
  it('echoes the challenge on subscribe', async () => {
    const res = await req()
      .get('/api/v1/webhooks/inbound/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wco-verify-dev', 'hub.challenge': 'CHALLENGE42' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('CHALLENGE42');
  });

  it('rejects bad tokens', async () => {
    const res = await req()
      .get('/api/v1/webhooks/inbound/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': 'X' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Ingress -> AI responder turn pipeline
// ---------------------------------------------------------------------------

describe('webhook ingress -> AI responder (inline)', () => {
  it('persists the inbound message and answers with a grounded bot reply', async () => {
    const res = await postWebhook(metaBody('wamid.price.1', '+2348010000001', 'hello, how much is the rice?'));
    expect(res.status).toBe(200);
    expect(res.text).toBe('EVENT_RECEIVED');

    const thread = await threadForPhone('+2348010000001');
    const msgs = messagesOf(thread.id);
    const inbound = msgs.find((m) => m.direction === 'INBOUND');
    const outbound = msgs.find((m) => m.direction === 'OUTBOUND');
    expect(inbound).toMatchObject({ type: 'TEXT', body: 'hello, how much is the rice?', status: 'RECEIVED', waMessageId: 'wamid.price.1' });
    expect(outbound?.sentByBot).toBe(true);
    expect(outbound?.body).toContain('Rice 5kg');

    const log = (db.aiResponseLog as Array<Record<string, unknown>>).at(-1) as Record<string, unknown>;
    expect(log).toMatchObject({ intent: 'PRICE_INQUIRY', escalated: false, source: 'heuristic' });
    expect(Number(log.latencyMs)).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('dedupes replayed webhooks by waMessageId', async () => {
    const before = db.message.length;
    await postWebhook(metaBody('wamid.price.1', '+2348010000001', 'hello, how much is the rice?'));
    expect(db.message.length).toBe(before);
  });

  it('answers greetings with the canned welcome template', async () => {
    await postWebhook(metaBody('wamid.hello.1', '+2348010000002', 'Hello there!'));
    const thread = await threadForPhone('+2348010000002');
    const outbound = messagesOf(thread.id).find((m) => m.direction === 'OUTBOUND');
    expect(outbound?.sentByBot).toBe(true);
    expect(outbound?.body).toContain('Chat HQ');
  });

  it('escalates hard intents to humans without sending a bot reply', async () => {
    await postWebhook(metaBody('wamid.refund.1', '+2348010000003', 'I want my money back right now'));
    const thread = await threadForPhone('+2348010000003');

    expect(thread.status).toBe('HANDLED');
    expect(thread.botEnabled).toBe(false);

    const list = await req().get('/api/v1/message-escalations').set(ownerHeaders);
    const esc = (list.body.data as Array<Record<string, unknown>>).find((e) => e.threadId === thread.id);
    expect(esc).toBeDefined();
    expect(esc).toMatchObject({ reason: 'REFUND_REQUEST', status: 'OPEN' });

    const log = (db.aiResponseLog as Array<Record<string, unknown>>).at(-1) as Record<string, unknown>;
    expect(log.escalated).toBe(true);
    expect(messagesOf(thread.id).some((m) => m.direction === 'OUTBOUND')).toBe(false);
  }, 30000);

  it('escalates low-confidence gibberish with LOW_CONFIDENCE reason', async () => {
    await postWebhook(metaBody('wamid.gib.1', '+2348010000004', 'xkcd flurb quux zzz'));
    const thread = await threadForPhone('+2348010000004');
    const list = await req().get('/api/v1/message-escalations').set(ownerHeaders);
    const esc = (list.body.data as Array<Record<string, unknown>>).find((e) => e.threadId === thread.id);
    expect(esc).toMatchObject({ reason: 'LOW_CONFIDENCE' });
  });

  it('escalates configured keywords even when intent confidence is high', async () => {
    const put = await req()
      .put('/api/v1/ai-configurations').set(ownerHeaders)
      .send({ escalationKeywords: ['lawyer'] });
    expect(put.status).toBe(200);

    await postWebhook(metaBody('wamid.kw.1', '+2348010000005', 'my lawyer will contact you about this order'));
    const thread = await threadForPhone('+2348010000005');
    const list = await req().get('/api/v1/message-escalations').set(ownerHeaders);
    const esc = (list.body.data as Array<Record<string, unknown>>).find((e) => e.threadId === thread.id);
    expect(esc).toBeDefined();

    // Clean up so later scenarios stay bot-handled.
    await req().put('/api/v1/ai-configurations').set(ownerHeaders).send({ escalationKeywords: [] });
  }, 30000);

  it('ignores messages routed to an unverified phone number id', async () => {
    const before = db.message.length;
    const res = await postWebhook(metaBody('wamid.other.1', '+2348010000099', 'hello?', 'PNID-UNKNOWN'));
    expect(res.status).toBe(200);
    expect(db.message.length).toBe(before);
  });

  it('accepts malformed JSON bodies with EVENT_RECEIVED (no retry storms)', async () => {
    const res = await req()
      .post('/api/v1/webhooks/inbound/whatsapp')
      .set('Content-Type', 'application/json')
      .send('{"entry": broken');
    expect(res.status).toBe(200);
    expect(res.text).toBe('EVENT_RECEIVED');
  });
});

// ---------------------------------------------------------------------------
// Threads API
// ---------------------------------------------------------------------------

describe('threads API', () => {
  let customerId = '';
  let threadId = '';

  it('find-or-creates threads for a customer', async () => {
    const customer = await req()
      .post('/api/v1/customers').set(ownerHeaders)
      .send({ waPhone: '+2348030000001', name: 'Ngozi Eze' });
    expect(customer.status).toBe(201);
    customerId = customer.body.data.id as string;

    const first = await req().post('/api/v1/message-threads').set(ownerHeaders).send({ customerId });
    expect(first.status).toBe(201);
    const second = await req().post('/api/v1/message-threads').set(agentHeaders).send({ customerId });
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    threadId = first.body.data.id as string;
  });

  it('decorates threads with their customer and supports pagination/filters', async () => {
    const page = await req().get('/api/v1/message-threads?page=1&pageSize=2').set(ownerHeaders);
    expect(page.status).toBe(200);
    expect(page.body.data.length).toBeLessThanOrEqual(2);
    expect(page.body.meta.pagination.totalItems).toBeGreaterThanOrEqual(5);
    expect(page.body.data[0].customer).toMatchObject({ id: expect.any(String) });

    const byCustomer = await req().get(`/api/v1/message-threads?customerId=${customerId}`).set(ownerHeaders);
    expect(byCustomer.body.data).toHaveLength(1);
    expect(byCustomer.body.data[0].id).toBe(threadId);

    const byStatus = await req().get('/api/v1/message-threads?status=BOT').set(ownerHeaders);
    (byStatus.body.data as ThreadRow[]).forEach((t) => expect(t.status).toBe('BOT'));
  });

  it('assigns agents and filters assignedToMe', async () => {
    const agentRow = (db.user as Array<Record<string, unknown>>).find((u) => u.email === 'agent@messages.test');
    const patch = await req()
      .patch(`/api/v1/message-threads/${threadId}`).set(ownerHeaders)
      .send({ status: 'HANDLED', botEnabled: false, assignedUserId: (agentRow?.id as string) ?? null });
    expect(patch.status).toBe(200);
    expect(patch.body.data).toMatchObject({ status: 'HANDLED', botEnabled: false });

    const mine = await req().get('/api/v1/message-threads?assignedToMe=true').set(agentHeaders);
    expect((mine.body.data as ThreadRow[]).some((t) => t.id === threadId)).toBe(true);

    // Restore bot mode for later scenarios.
    await req().patch(`/api/v1/message-threads/${threadId}`).set(ownerHeaders).send({ status: 'BOT' });
  });

  it('closes threads and enforces read-only semantics', async () => {
    const close = await req().patch(`/api/v1/message-threads/${threadId}`).set(ownerHeaders).send({ status: 'CLOSED' });
    expect(close.status).toBe(200);

    const edit = await req().patch(`/api/v1/message-threads/${threadId}`).set(ownerHeaders).send({ status: 'BOT' });
    expect(edit.status).toBe(409);

    const send = await req()
      .post('/api/v1/messages/send').set(agentHeaders)
      .send({ threadId, body: 'should be blocked' });
    expect(send.status).toBe(409);

    const remove = await req().delete(`/api/v1/message-threads/${threadId}`).set(ownerHeaders);
    expect(remove.status).toBe(200); // CLOSED + no messages yet
    const gone = await req().get(`/api/v1/message-threads/${threadId}`).set(ownerHeaders);
    expect(gone.status).toBe(404);
  });

  it('isolates tenants on every thread route', async () => {
    const foreign = await req().get('/api/v1/message-threads').set(rivalHeaders);
    expect(foreign.body.data).toHaveLength(0);

    const someThread = (await req().get('/api/v1/message-threads').set(ownerHeaders)).body.data[0] as ThreadRow;
    const cross = await req().get(`/api/v1/message-threads/${someThread.id}`).set(rivalHeaders);
    expect(cross.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Message feed, search, export
// ---------------------------------------------------------------------------

describe('message feed', () => {
  let threadId = '';

  beforeAll(async () => {
    // Fresh thread with known content: two inbound turns -> replies.
    await postWebhook(metaBody('wamid.feed.1', '+2348010000020', 'hello'));
    await postWebhook(metaBody('wamid.feed.2', '+2348010000020', 'how much is the rice?'));
    threadId = (await threadForPhone('+2348010000020')).id;
  });

  it('lists newest-first with cursor pagination and marks read', async () => {
    const threadBefore = await req().get(`/api/v1/message-threads/${threadId}`).set(ownerHeaders);
    expect(Number(threadBefore.body.data.unreadCount)).toBeGreaterThan(0);

    const page1 = await req().get(`/api/v1/message-threads/${threadId}/messages?limit=2`).set(agentHeaders);
    expect(page1.status).toBe(200);
    const items1 = page1.body.data as MessageRow[];
    expect(items1).toHaveLength(2);
    expect(typeof page1.body.meta.pagination.nextCursor).toBe('string');
    expect(new Date(items1[0].createdAt as unknown as string) >= new Date(items1[1].createdAt as unknown as string)).toBe(true);

    const page2 = await req()
      .get(`/api/v1/message-threads/${threadId}/messages?limit=2&cursor=${page1.body.meta.pagination.nextCursor}`)
      .set(agentHeaders);
    const items2 = page2.body.data as MessageRow[];
    expect(items2.length).toBeGreaterThanOrEqual(2);
    const ids1 = new Set(items1.map((m) => m.id));
    items2.forEach((m) => expect(ids1.has(m.id)).toBe(false));

    const after = await req().get(`/api/v1/message-threads/${threadId}`).set(ownerHeaders);
    expect(Number(after.body.data.unreadCount)).toBe(0);
  });

  it('searches store-wide by text across threads', async () => {
    const hits = await req().get('/api/v1/messages/search?q=money back').set(ownerHeaders);
    expect(hits.status).toBe(200);
    const rows = hits.body.data as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThanOrEqual(1);
    rows.forEach((r) => expect(String(r.body).toLowerCase()).toContain('money back'));
  });

  it('exports the store feed as CSV', async () => {
    const res = await req().get('/api/v1/messages/export').set(ownerHeaders);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    const lines = (res.text as string).trim().split(/\r?\n/);
    expect(lines[0]).toBe('createdAt,threadId,direction,type,status,sentByBot,body');
    expect(lines.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Manual sends
// ---------------------------------------------------------------------------

describe('manual sends', () => {
  let customerId = '';
  let threadId = '';

  beforeAll(async () => {
    const customer = await req()
      .post('/api/v1/customers').set(ownerHeaders)
      .send({ waPhone: '+2348030000002', name: 'Chinedu Okafor' });
    customerId = customer.body.data.id as string;
    threadId = (await req().post('/api/v1/message-threads').set(ownerHeaders).send({ customerId })).body.data.id;
  });

  it('sends by threadId as the acting agent', async () => {
    const res = await req()
      .post('/api/v1/messages/send').set(agentHeaders)
      .send({ threadId, type: 'TEXT', body: 'Your order is confirmed!' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      conversationId: threadId,
      direction: 'OUTBOUND',
      status: 'QUEUED',
      sentByBot: false,
      body: 'Your order is confirmed!',
    });
  });

  it('sends by customerId via find-or-create', async () => {
    const res = await req()
      .post('/api/v1/messages/send').set(agentHeaders)
      .send({ customerId, body: 'Payment details attached soon.' });
    expect(res.status).toBe(201);
    expect(res.body.data.conversationId).toBe(threadId);
  });

  it('validates outbound bodies and media rules', async () => {
    const neither = await req().post('/api/v1/messages/send').set(agentHeaders).send({});
    expect(neither.status).toBe(422);

    const emptyText = await req().post('/api/v1/messages/send').set(agentHeaders).send({ threadId, body: '' });
    expect(emptyText.status).toBe(422);

    const textWithMediaUrl = await req()
      .post('/api/v1/messages/send').set(agentHeaders)
      .send({ threadId, type: 'TEXT', mediaUrl: 'https://cdn.example.com/a.png' });
    expect(textWithMediaUrl.status).toBe(422);

    const okImage = await req()
      .post('/api/v1/messages/send').set(agentHeaders)
      .send({ threadId, type: 'IMAGE', mediaUrl: 'https://cdn.example.com/receipt.png' });
    expect(okImage.status).toBe(201);
    expect(okImage.body.data.type).toBe('IMAGE');
  });

  it('rejects viewer sends with 403', async () => {
    const res = await req()
      .post('/api/v1/messages/send').set(viewerHeaders)
      .send({ threadId, body: 'viewer cannot send' });
    expect([400, 401, 403]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

describe('attachments', () => {
  let messageId = '';

  beforeAll(async () => {
    const customer = await req()
      .post('/api/v1/customers').set(ownerHeaders)
      .send({ waPhone: '+2348030000003', name: 'Fatima Bello' });
    const thread = await req()
      .post('/api/v1/message-threads').set(ownerHeaders)
      .send({ customerId: customer.body.data.id });
    const sent = await req()
      .post('/api/v1/messages/send').set(agentHeaders)
      .send({ threadId: thread.body.data.id, body: 'Invoice attached separately.' });
    messageId = sent.body.data.id as string;
  });

  const pngPart = (bytes: number): Buffer =>
    Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(Math.max(0, bytes - 8), 7)]);

  it('uploads and lists message media within limits', async () => {
    const up = await req()
      .post(`/api/v1/messages/${messageId}/attachments`).set(agentHeaders)
      .attach('file', pngPart(2048), { filename: 'receipt.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect(up.body.data).toMatchObject({ messageId, mimeType: 'image/png' });

    const list = await req().get(`/api/v1/messages/${messageId}/attachments`).set(ownerHeaders);
    expect(list.status).toBe(200);
    expect(list.body.data as Array<unknown>).toHaveLength(1);
  });

  it('rejects disallowed mime types with 415', async () => {
    const res = await req()
      .post(`/api/v1/messages/${messageId}/attachments`).set(agentHeaders)
      .attach('file', Buffer.from('plain text'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(res.status).toBe(415);
  });

  it('rejects oversized uploads with 413', async () => {
    const res = await req()
      .post(`/api/v1/messages/${messageId}/attachments`).set(agentHeaders)
      .attach('file', pngPart(10 * 1024 * 1024 + 64), { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(413);
  });

  it('404s unknown messages', async () => {
    const missing = await req()
      .post('/api/v1/messages/nonexistent/attachments').set(agentHeaders)
      .attach('file', pngPart(128), { filename: 'x.png', contentType: 'image/png' });
    expect(missing.status).toBe(404);

    const listMissing = await req().get('/api/v1/messages/nonexistent/attachments').set(ownerHeaders);
    expect(listMissing.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Direct ingress (/messages/receive)
// ---------------------------------------------------------------------------

describe('direct ingress', () => {
  it('accepts media messages into the same conversation', async () => {
    await postWebhook(metaBody('wamid.img.0', '+2348010000020', 'hello again'));
    const res = await req()
      .post('/api/v1/messages/receive').set(agentHeaders)
      .send({
        storePhoneNumberId: phoneNumberId,
        fromPhone: '+2348010000020',
        waMessageId: 'wamid.img.2',
        type: 'image',
        mediaUrl: 'https://ps.wa.me/v/media.jpg',
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ direction: 'INBOUND', type: 'IMAGE', status: 'RECEIVED' });
  });

  it('rejects unsupported types without body or media', async () => {
    const res = await req()
      .post('/api/v1/messages/receive').set(agentHeaders)
      .send({
        storePhoneNumberId: phoneNumberId,
        fromPhone: '+2348010000099',
        waMessageId: 'wamid.loc.1',
        type: 'location',
      });
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// Escalation lifecycle
// ---------------------------------------------------------------------------

describe('escalations lifecycle', () => {
  let escalationId = '';

  beforeAll(async () => {
    const refundThread = (await threadForPhone('+2348010000003')).id;
    const list = await req().get(`/api/v1/message-escalations?threadId=${refundThread}`).set(ownerHeaders);
    escalationId = ((list.body.data as Array<Record<string, unknown>>)[0].id) as string;
    expect(escalationId).toBeTruthy();
  });

  it('creates manual escalations idempotently per open thread', async () => {
    const otherThread = (await threadForPhone('+2348010000004')).id; // gibberish thread
    const created = await req()
      .post('/api/v1/message-escalations').set(agentHeaders)
      .send({ threadId: otherThread, reason: 'COMPLAINT' });
    expect(created.status).toBe(201);

    const dup = await req()
      .post('/api/v1/message-escalations').set(agentHeaders)
      .send({ threadId: otherThread, reason: 'COMPLAINT' });
    expect(dup.status).toBe(201);
    expect(dup.body.data.id).toBe(created.body.data.id);

    const rows = (db.messageEscalation as Array<Record<string, unknown>>).filter((e) => e.threadId === otherThread);
    expect(rows).toHaveLength(1);
  });

  it('allows PUT for notes but not terminal statuses', async () => {
    const noted = await req()
      .put(`/api/v1/message-escalations/${escalationId}`).set(ownerHeaders)
      .send({ notes: 'Customer asked for a refund of the rice order.' });
    expect(noted.status).toBe(200);
    expect(noted.body.data.notes).toContain('refund');

    const directStatus = await req()
      .put(`/api/v1/message-escalations/${escalationId}`).set(ownerHeaders)
      .send({ status: 'RESOLVED' });
    expect([409, 422]).toContain(directStatus.status);
  });

  it('resolves with an audit trail and blocks double-resolve', async () => {
    const resolved = await req()
      .post(`/api/v1/message-escalations/${escalationId}/resolve`).set(agentHeaders)
      .send({ notes: 'Refunded via store credit.' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data).toMatchObject({ status: 'RESOLVED' });
    expect(resolved.body.data.resolvedAt).toBeTruthy();

    const again = await req().post(`/api/v1/message-escalations/${escalationId}/resolve`).set(agentHeaders).send({});
    expect(again.status).toBe(409);
  });

  it('dismisses instead of hard-deleting', async () => {
    const gibberishThread = (await threadForPhone('+2348010000004')).id;
    const list = await req().get(`/api/v1/message-escalations?threadId=${gibberishThread}`).set(ownerHeaders);
    const target = ((list.body.data as Array<Record<string, unknown>>)[0]).id as string;

    const dismissed = await req().delete(`/api/v1/message-escalations/${target}`).set(ownerHeaders);
    expect(dismissed.status).toBe(200);
    expect(dismissed.body.data.status).toBe('DISMISSED');

    const stillThere = await req().get('/api/v1/message-escalations?status=DISMISSED').set(ownerHeaders);
    expect((stillThere.body.data as Array<Record<string, unknown>>).some((e) => e.id === target)).toBe(true);
  });

  it('isolates tenants', async () => {
    const rivalList = await req().get('/api/v1/message-escalations').set(rivalHeaders);
    expect(rivalList.body.data as Array<unknown>).toHaveLength(0);
    const cross = await req().get(`/api/v1/message-escalations/${escalationId}`).set(rivalHeaders);
    expect(cross.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// AI configuration + intents + dry-run + send-as-bot
// ---------------------------------------------------------------------------

describe('ai endpoints', () => {
  it('returns lazy defaults on first read', async () => {
    const cfg = await req().get('/api/v1/ai-configurations').set(ownerHeaders);
    expect(cfg.status).toBe(200);
    expect(cfg.body.data).toMatchObject({
      isEnabled: true,
      autoReplyEnabled: true,
      tone: 'FRIENDLY',
      confidenceThreshold: 0.6,
    });
    expect(cfg.body.data.workingHours).toMatchObject({ start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] });
  });

  it('updates partial config fields', async () => {
    const put = await req()
      .put('/api/v1/ai-configurations').set(ownerHeaders)
      .send({ tone: 'PROFESSIONAL' });
    expect(put.status).toBe(200);
    expect(put.body.data.tone).toBe('PROFESSIONAL');
    expect(put.body.data.confidenceThreshold).toBe(0.6);
  });

  it('dry-runs classification without persisting anything', async () => {
    const beforeMsgs = db.message.length;
    const beforeLogs = (db.aiResponseLog as Array<unknown>).length;

    const test = await req()
      .post('/api/v1/ai-configurations/test').set(ownerHeaders)
      .send({ message: 'how much is the rice?' });
    expect(test.status).toBe(200);
    expect(test.body.data).toMatchObject({ intent: 'PRICE_INQUIRY', language: 'en', wouldEscalate: false });
    expect(Number(test.body.data.confidence)).toBeGreaterThan(0.6);
    expect(String(test.body.data.draftReply).length).toBeGreaterThan(5);

    const gibberish = await req()
      .post('/api/v1/ai-configurations/test').set(ownerHeaders)
      .send({ message: 'xkcd flurb quux zzz' });
    expect(gibberish.body.data.wouldEscalate).toBe(true);

    expect(db.message.length).toBe(beforeMsgs);
    expect((db.aiResponseLog as Array<unknown>).length).toBe(beforeLogs);
  });

  it('manages custom intents end-to-end', async () => {
    const create = await req()
      .post('/api/v1/ai-configurations/intents').set(ownerHeaders)
      .send({ name: 'WHOLESALE', keywords: ['bulk price'], cannedResponse: 'Bulk deals unlock from 20 units!', priority: 10 });
    expect(create.status).toBe(201);

    const dup = await req()
      .post('/api/v1/ai-configurations/intents').set(ownerHeaders)
      .send({ name: 'WHOLESALE', keywords: ['other'], priority: 5 });
    expect(dup.status).toBe(409);

    const detect = await req()
      .post('/api/v1/ai-responses/detect-intent').set(agentHeaders)
      .send({ text: 'do you do bulk price for rice?' });
    expect(detect.body.data).toMatchObject({ intent: 'WHOLESALE', confidence: 0.9 });

    const entities = await req()
      .post('/api/v1/ai-responses/extract-entities').set(agentHeaders)
      .send({ text: 'i want two bags, i can pay 3.5k' });
    expect(entities.status).toBe(200);
    expect(entities.body.data.amounts).toEqual([3500]);

    const list = await req().get('/api/v1/ai-configurations/intents').set(viewerHeaders);
    expect(list.status).toBe(200);
    expect((list.body.data as Array<Record<string, unknown>>).some((i) => i.name === 'WHOLESALE')).toBe(true);

    const patched = await req()
      .put(`/api/v1/ai-configurations/intents/${create.body.data.id}`).set(ownerHeaders)
      .send({ isActive: false });
    expect(patched.status).toBe(200);
    expect(patched.body.data.isActive).toBe(false);

    const fallback = await req()
      .post('/api/v1/ai-responses/detect-intent').set(agentHeaders)
      .send({ text: 'do you do bulk price for rice?' });
    expect(fallback.body.data.intent).not.toBe('WHOLESALE');

    const removed = await req().delete(`/api/v1/ai-configurations/intents/${create.body.data.id}`).set(ownerHeaders);
    expect(removed.status).toBe(200);
  });

  it('generates drafts without side effects and sends as the bot on demand', async () => {
    const threadId = (await threadForPhone('+2348010000020')).id;
    const beforeMsgs = db.message.length;

    const draft = await req()
      .post('/api/v1/ai-responses/generate').set(agentHeaders)
      .send({ threadId, text: 'do you have rice in stock?' });
    expect(draft.status).toBe(200);
    expect(String(draft.body.data.draft)).toContain('Rice 5kg');
    expect(draft.body.data.source).toBe('heuristic');
    expect(db.message.length).toBe(beforeMsgs); // dry-run persists nothing

    const send = await req()
      .post('/api/v1/ai-responses/send').set(agentHeaders)
      .send({ threadId, body: 'Yes! Rice 5kg is in stock.' });
    expect(send.status).toBe(201);
    expect(send.body.data).toMatchObject({ direction: 'OUTBOUND', sentByBot: true, status: 'QUEUED' });
    expect(db.message.length).toBe(beforeMsgs + 1);
  });

  it('blocks viewer mutations', async () => {
    const put = await req().put('/api/v1/ai-configurations').set(viewerHeaders).send({ tone: 'FORMAL' });
    expect([400, 401, 403]).toContain(put.status);
    const intent = await req()
      .post('/api/v1/ai-configurations/intents').set(viewerHeaders)
      .send({ name: 'NOPE', keywords: ['x'], priority: 1 });
    expect([400, 401, 403]).toContain(intent.status);
  });
});

// ---------------------------------------------------------------------------
// Flat message routes + final sweep
// ---------------------------------------------------------------------------

describe('flat message routes', () => {
  it('fetches store-scoped messages by id and 404s foreign rows', async () => {
    const feed = await req().get('/api/v1/messages?pageSize=5').set(ownerHeaders);
    expect(feed.status).toBe(200);
    const someMessage = (feed.body.data as MessageRow[])[0];
    expect(someMessage).toBeDefined();

    const own = await req().get(`/api/v1/messages/${someMessage.id}`).set(agentHeaders);
    expect(own.status).toBe(200);
    expect(own.body.data.id).toBe(someMessage.id);

    const cross = await req().get(`/api/v1/messages/${someMessage.id}`).set(rivalHeaders);
    expect(cross.status).toBe(404);
  });

  it('supports the store-wide feed with direction filters', async () => {
    const inboundOnly = await req().get('/api/v1/messages?direction=INBOUND&pageSize=50').set(ownerHeaders);
    (inboundOnly.body.data as MessageRow[]).forEach((m) => expect(m.direction).toBe('INBOUND'));

    const outboundOnly = await req().get('/api/v1/messages?direction=OUTBOUND&pageSize=50').set(ownerHeaders);
    (outboundOnly.body.data as MessageRow[]).forEach((m) => expect(m.direction).toBe('OUTBOUND'));
  });
});


