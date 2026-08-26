/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * In-memory Prisma double for hermetic integration tests.
 *
 * Scope honesty: this stub implements ONLY the operations the tested flows
 * exercise (auth lifecycle, tenant scoping, team listing, health probes) with
 * faithful semantics. It is not a general-purpose database - specs needing
 * full SQL behavior must run against live Postgres (RUN_INTEGRATION_TESTS).
 *
 * The singleton pattern exists because jest.mock factories are hoisted and
 * cannot close over test-body variables; the factory calls createInMemoryPrisma()
 * and the test body reaches the same instance via getInMemoryDb().
 */

interface Row {
  id: string;
  [key: string]: any;
}

let seq = 0;
const nextId = (): string => `test_${String(++seq).padStart(6, '0')}`;

export interface InMemoryDb {
  merchant: any[];
  user: any[];
  refreshToken: any[];
  store: any[];
  apiToken: any[];
  product: any[];
  order: any[];
  conversation: any[];
  message: any[];
  messageAttachment: any[];
  messageEscalation: any[];
  aiIntent: any[];
  aiConfiguration: any[];
  aiResponseLog: any[];
  campaign: any[];
  campaignMessage: any[];
  payment: any[];
  delivery: any[];
  auditLog: any[];
  outboxEvent: any[];
  dailyStoreMetric: any[];
  passwordReset: any[];
  emailVerification: any[];
  phoneVerification: any[];
  twoFactorSecret: any[];
    sellerProfile: any[];
    adminProfile: any[];
    whatsappConnection: any[];
    merchantDeliveryProvider: any[];
    paymentMethod: any[];
    deliveryProvider: any[];
    subscriptionPlan: any[];
    subscription: any[];
    customer: any[];
  customerTag: any[];
  customerNote: any[];
  customerSegment: any[];
  customerSegmentMember: any[];
  category: any[];
  productVariant: any[];
  productImage: any[];
  productDiscount: any[];
  productTag: any[];
  productTagOnProduct: any[];
  inventoryLedger: any[];
  priceSuggestion: any[];
  orderItem: any[];
  orderStatusHistory: any[];
  orderNote: any[];
    orderRefund: any[];
    orderCancellation: any[];
    paymentTransaction: any[];
    paymentWebhook: any[];
    oauthAccount: any[];
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $disconnect: jest.Mock;
  reset(): void;
}

let current: InMemoryDb | null = null;
let dbHealthy = true;

export function setMemoryDbHealthy(value: boolean): void {
  dbHealthy = value;
}

export function createInMemoryPrisma(): InMemoryDb {
  const db: InMemoryDb = {
    merchant: [],
    user: [],
    refreshToken: [],
    store: [],
    apiToken: [],
    product: [],
    order: [],
    conversation: [],
    message: [],
    messageAttachment: [],
    messageEscalation: [],
    aiIntent: [],
    aiConfiguration: [],
    aiResponseLog: [],
    campaign: [],
    campaignMessage: [],
    payment: [],
    delivery: [],
    auditLog: [],
    outboxEvent: [],
    dailyStoreMetric: [],
    passwordReset: [],
    emailVerification: [],
    phoneVerification: [],
    twoFactorSecret: [],
    oauthAccount: [],
    sellerProfile: [],
    adminProfile: [],
    whatsappConnection: [],
    merchantDeliveryProvider: [],
    paymentMethod: [],
    deliveryProvider: [],
    subscriptionPlan: [],
    subscription: [],
    customer: [],
    customerTag: [],
    customerNote: [],
    customerSegment: [],
    customerSegmentMember: [],
    category: [],
    productVariant: [],
    productImage: [],
    productDiscount: [],
    productTag: [],
    productTagOnProduct: [],
    inventoryLedger: [],
    priceSuggestion: [],
    orderItem: [],
    orderStatusHistory: [],
    orderNote: [],
    orderRefund: [],
    orderCancellation: [],
    paymentTransaction: [],
    paymentWebhook: [],

    // Array-form transactions execute sequentially and return results in order.
    // Function-form (interactive) callbacks receive a prisma-shaped client view
    // over the SAME underlying arrays, mirroring Prisma's tx semantics closely
    // enough for the money paths (order create/transition/cancel).
    $transaction: jest.fn(async (opsOrFn: unknown) => {
      if (typeof opsOrFn === 'function') {
        return await (opsOrFn as (tx: unknown) => unknown)(makeTransactionClient(db));
      }
      const results: unknown[] = [];
      for (const op of opsOrFn as unknown[]) results.push(await op);
      return results;
    }),
    $queryRaw: jest.fn(async () => []),
    $disconnect: jest.fn(async () => undefined),

    reset(): void {
      db.merchant = [];
      db.user = [];
      db.refreshToken = [];
      db.store = [];
      db.apiToken = [];
      db.product = [];
      db.order = [];
      db.conversation = [];
      db.message = [];
      db.messageAttachment = [];
      db.messageEscalation = [];
      db.aiIntent = [];
      db.aiConfiguration = [];
      db.aiResponseLog = [];
      db.campaign = [];
      db.campaignMessage = [];
      db.payment = [];
      db.delivery = [];
      db.auditLog = [];
      db.outboxEvent = [];
      db.dailyStoreMetric = [];
      db.passwordReset = [];
      db.emailVerification = [];
      db.phoneVerification = [];
      db.twoFactorSecret = [];
      db.oauthAccount = [];
      db.sellerProfile = [];
      db.adminProfile = [];
      db.whatsappConnection = [];
      db.merchantDeliveryProvider = [];
      db.paymentMethod = [];
      db.deliveryProvider = [];
      db.subscriptionPlan = [];
      db.subscription = [];
      db.customer = [];
      db.customerTag = [];
      db.customerNote = [];
      db.customerSegment = [];
      db.customerSegmentMember = [];
      db.category = [];
      db.productVariant = [];
      db.productImage = [];
      db.productDiscount = [];
      db.productTag = [];
      db.productTagOnProduct = [];
      db.inventoryLedger = [];
      db.priceSuggestion = [];
      db.orderItem = [];
      db.orderStatusHistory = [];
      db.orderNote = [];
      db.orderRefund = [];
      db.orderCancellation = [];
      db.paymentTransaction = [];
      db.paymentWebhook = [];
      seq = 0;
    },
  };
  return db;
}

export function getInMemoryDb(): InMemoryDb {
  current ??= createInMemoryPrisma();
  return current;
}

// ---------------------------------------------------------------------------
// Model shims
// ---------------------------------------------------------------------------

/** Declared @@unique constraints - enforced so services see P2002 like Prisma. */
const UNIQUE_KEYS: Record<string, string[][]> = {
  merchant: [['companyName']],
  store: [['slug'], ['merchantId', 'name']],
  user: [['email']],
  customer: [['storeId', 'waPhone']],
  customerTag: [['storeId', 'name']],
  category: [['storeId', 'name']],
  product: [['storeId', 'sku']],
  productVariant: [['productId', 'sku']],
  productTag: [['storeId', 'name']],
  productDiscount: [['storeId', 'code']],
  order: [['orderNumber']],
  orderCancellation: [['orderId']],
  aiIntent: [['storeId', 'name']],
};

function assertUniques(model: string, candidates: Row[], data: Record<string, unknown>): void {
  const registry = UNIQUE_KEYS as Record<string, string[][] | undefined>;
  const defs = registry[model];
  if (defs === undefined) return;
  for (const combo of defs) {
    if (combo.some((k) => data[k] === undefined)) continue;
    const clash = candidates.some((r) => combo.every((k) => r[k] === data[k]));
    if (clash) {
      throw Object.assign(
        new Error(`Unique constraint failed on the constraint: \`${model}_${combo.join('_')}_key\``),
        { code: 'P2002' },
      );
    }
  }
}

function makeDelegate(table: Row[] | ((db: InMemoryDb) => Row[]), model = ''): Record<string, unknown> {
  const rows = (): Row[] => (typeof table === 'function' ? table(getInMemoryDb()) : table);

  const self = {
    findUnique: async ({ where, include }: any) => {
      const found = findByWhere(rows(), where);
      return found ? decorate(found, undefined, include) : null;
    },
    findUniqueOrThrow: async ({ where, include }: any) => {
      const found = await self.findUnique({ where, include });
      if (!found) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
      return found;
    },
    findFirstOrThrow: async (args: any) => {
      const found = await self.findFirst(args);
      if (!found) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
      return found;
    },
    findFirst: async ({ where, orderBy, include }: any) => {
      const found = filterWhere(rows(), where)[0] ?? null;
      return decorate(found, orderBy, include);
    },
    findMany: async ({ where, take, skip, orderBy, select, include }: any) => {
      let out = filterWhere(rows(), where);
      // Prisma allows array orderBy - merge into one precedence object.
      const order = Array.isArray(orderBy)
        ? Object.assign({}, ...orderBy) as Record<string, unknown>
        : orderBy as Record<string, unknown> | undefined;
      if (order && Object.keys(order).length > 0) out = sortRows(out, order);
      if (skip !== undefined && skip > 0) out = out.slice(skip);
      if (take !== undefined) out = out.slice(0, take);
      if (select) out = out.map((r) => project(r, select));
      else if (include) out = out.map((r) => decorate(r, orderBy, include)).filter((r): r is Row => r !== null);
      return out;
    },
    create: async ({ data, include }: any) => {
      // Signup nests owner-user creation under merchant.create - materialize it.
      const nestedUserCreates = data?.users?.create;
      // Orders nest their line items (orderItem rows) under order.create.
      const nestedOrderItems = model === 'order' ? data?.items?.create : undefined;
      const row = { id: nextId(), createdAt: new Date(), ...materialize(data) } as Row;
      assertUniques(model, rows(), row as Record<string, unknown>);
      rows().push(row);
      if (nestedUserCreates) {
        const db = getInMemoryDb();
        for (const u of Array.isArray(nestedUserCreates) ? nestedUserCreates : [nestedUserCreates]) {
          db.user.push({ id: nextId(), createdAt: new Date(), isActive: true, role: 'OWNER', ...materialize(u), merchantId: row.id });
        }
      }
      if (nestedOrderItems) {
        const db = getInMemoryDb();
        for (const item of Array.isArray(nestedOrderItems) ? nestedOrderItems : [nestedOrderItems]) {
          db.orderItem.push({ id: nextId(), createdAt: new Date(), orderId: row.id, ...materialize(item) });
        }
      }
      return decorate(row, undefined, include);
    },
    update: async ({ where, data }: any) => {
      const row = await firstOrNull(rows(), where);
      if (!row) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
      const next = { ...row, ...materialize(data) } as Row;
      assertUniques(model, rows().filter((r) => r !== row), next as Record<string, unknown>);
      applyUpdate(row, materialize(data));
      return row;
    },
    updateMany: async ({ where, data }: any) => {
      const matches = filterWhere(rows(), where);
      for (const row of matches) applyUpdate(row, materialize(data));
      return { count: matches.length };
    },
    delete: async ({ where }: any) => {
      const idx = rows().findIndex((r) => matchesWhere(r, where));
      if (idx === -1) throw Object.assign(new Error('Record not found'), { code: 'P2025' });
      return rows().splice(idx, 1)[0];
    },
    deleteMany: async ({ where }: any) => {
      const before = rows().length;
      const keep = rows().filter((r) => !matchesWhere(r, where));
      rows().length = 0;
      rows().push(...keep);
      return { count: before - keep.length };
    },
    count: async ({ where }: any = {}) => filterWhere(rows(), where ?? {}).length,
    groupBy: async () => [],
    aggregate: async () => ({ _count: { _all: 0 }, _sum: {}, _avg: {}, _max: {}, _min: {} }),
    upsert: async ({ where, create, update, include }: any) => {
      const found = await self.findUnique({ where });
      if (found) {
        return self.update({ where, data: update ?? {} });
      }
      return self.create({ data: typeof create === 'function' ? create() : create, include });
    },
  };
  return self;

  async function firstOrNull(source: Row[], where: any): Promise<Row | null> {
    return source.find((r) => matchesUniqueWhere(r, where)) ?? null;
  }
}

/** Resolves unique-style wheres ({id}, {email}, compound uniques, operators). */
const FILTER_OPS = ['gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'not', 'contains', 'startsWith', 'endsWith', 'has'] as const;

const FILTER_HANDLERS: Record<string, (actual: unknown, target: unknown) => boolean> = {
  gt: (a, t) => (a as any) > (t as any),
  gte: (a, t) => (a as any) >= (t as any),
  lt: (a, t) => (a as any) < (t as any),
  lte: (a, t) => (a as any) <= (t as any),
  in: (a, t) => Array.isArray(t) && t.includes(a as never),
  notIn: (a, t) => Array.isArray(t) && !t.includes(a as never),
  not: (a, t) => !((a ?? null) === (t ?? null)),
  contains: (a, t) => String(a ?? '').includes(String(t ?? '')),
  startsWith: (a, t) => String(a ?? '').startsWith(String(t ?? '')),
  endsWith: (a, t) => String(a ?? '').endsWith(String(t ?? '')),
  // Scalar list membership (customers.tags).
  has: (a, t) => Array.isArray(a) && a.includes(t as never),
};

function compareOp(actual: unknown, op: Record<string, unknown>): boolean {
  const { mode, ...ops } = op;
  const ci = mode === 'insensitive';
  return Object.entries(ops).every(([name, target]) => {
    let a = actual;
    let t = target;
    if (ci && typeof t === 'string') {
      t = t.toLowerCase();
      a = typeof a === 'string' ? a.toLowerCase() : a;
    }
    const handler = FILTER_HANDLERS[name] as ((x: unknown, y: unknown) => boolean) | undefined;
    return handler ? handler(a, t) : false;
  });
}

function matchesWhere(row: Row, where: any): boolean {
  return Object.entries(where).every(([k, v]) => matchesEntry(row, k, v));
}

/** Relation key -> backing table (singular prisma model names we filter on). */
const RELATION_TABLES: Record<string, string> = {
  conversation: 'conversation',
  message: 'message',
  customer: 'customer',
  store: 'store',
  product: 'product',
  merchant: 'merchant',
  user: 'user',
  thread: 'conversation',
};

/**
 * Nested relation filters (`{ conversation: { storeId } }`): resolve the FK,
 * load the related row, recurse. Returns undefined when `k` is not a relation
 * of this row so scalar handling proceeds.
 */
function tryRelationFilter(row: Row, k: string, v: unknown): boolean | undefined {
  const fk = `${k}Id`;
  if (!(fk in row) || !isFilterObject(v)) return undefined;
  const table = RELATION_TABLES[k];
  if (table === undefined) return undefined;
  const db = getInMemoryDb() as unknown as Record<string, Row[]>;
  const related = db[table]?.find((r) => r.id === row[fk]);
  if (related === undefined) return false;
  return matchesWhere(related, v);
}

function matchesEntry(row: Row, k: string, v: unknown): boolean {
  if (k === 'OR' || k === 'AND' || k === 'NOT') return true; // handled by filterWhere
  // Operator objects ({gt: x}, {in: [...]}).
  if (!isFilterObject(v)) {
    return matchScalarEntry(row, k, v);
  }
  const relResult = tryRelationFilter(row, k, v);
  if (relResult !== undefined) return relResult;
  const keys = Object.keys(v).filter((k) => k !== 'mode');
  if (keys.length > 0 && keys.every((op) => (FILTER_OPS as readonly string[]).includes(op))) {
    return compareOp(row[k], v);
  }
  // Compound-unique key (e.g. provider_providerAccountId: {provider, providerAccountId}).
  const rec = v;
  const target = row as Record<string, unknown>;
  return Object.keys(rec).every((sub) => target[sub] === rec[sub]);
}

function matchScalarEntry(row: Row, k: string, v: unknown): boolean {
  if (k.endsWith('_id') && typeof v === 'string') {
    const field = k.slice(0, -3);
    return row[field] === v || row.id === v; // storeId_date compound etc. fall back to id
  }
  // Prisma compares against column NULL; unset JS keys must match null filters.
  const value = (row as Record<string, unknown>)[k];
  return (value === undefined ? null : value) === (v ?? null);
}

function isFilterObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);
}

function matchesUniqueWhere(row: Row, where: any): boolean {
  return matchesWhere(row, where);
}

function findByWhere(rows: Row[], where: any): Row | null {
  return rows.find((r) => matchesWhere(r, where)) ?? null;
}

function filterWhere(rows: Row[], where: any): Row[] {
  if (!where || Object.keys(where).length === 0) return [...rows];
  return rows.filter((r) => {
    if ('OR' in where && Array.isArray(where.OR)) {
      if (!where.OR.some((sub: any) => matchesWhere(r, sub))) return false;
    }
    return matchesWhere(r, where);
  });
}

function sortRows(out: Row[], orderBy: any): Row[] {
  const entries = Object.entries(orderBy);
  if (entries.length === 0) return out;
  return [...out].sort((a, b) => {
    for (const [key, dir] of entries) {
      const av = a[key];
      const bv = b[key];
      // Dates compare numerically; numbers numerically; else as strings.
      let cmp: number;
      if (av instanceof Date && bv instanceof Date) cmp = av.getTime() - bv.getTime();
      else if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
    }
    return 0;
  });
}

function project(row: Row, select: Record<string, unknown>): Row {
  const out: Row = { id: row.id };
  for (const key of Object.keys(select)) out[key] = row[key];
  return out;
}

/** Flattens prisma create/update payloads (incl. nested users.create). */
function materialize(data: any): Record<string, any> {
  const flat: Record<string, any> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      'create' in (value as Record<string, unknown>)
    ) {
      continue; // nested creates handled by the model shim below
    }
    flat[key] = value;
  }
  return flat;
}

/** Applies {increment}/{decrement} arithmetic operators, then plain assigns. */
function applyUpdate(row: Row, flat: Record<string, any>): void {
  for (const [key, value] of Object.entries(flat)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      const delta = 'increment' in value ? Number(value.increment) : 'decrement' in value ? -Number(value.decrement) : null;
      if (delta !== null) {
        const prev = row[key];
        row[key] = (typeof prev === 'number' ? prev : 0) + delta;
        continue;
      }
    }
    row[key] = value;
  }
}

/** Profile/relation includes shared by user- and profile-row decoration. */
function applyRelationIncludes(row: Row, include: Record<string, unknown> | undefined, db: InMemoryDb): void {
  if (include?.user) {
    row.user = db.user.find((u) => u.id === row.userId) ?? null;
  }
  if (include?.twoFactor) {
    row.twoFactor = db.twoFactorSecret.find((t) => t.userId === row.id) ?? null;
  }
  if (include?.sellerProfile) {
    row.sellerProfile = db.sellerProfile.find((p) => p.userId === row.id) ?? null;
  }
  if (include?.adminProfile) {
    row.adminProfile = db.adminProfile.find((p) => p.userId === row.id) ?? null;
  }
  applyOrderItemProductInclude(row, include, db);
  applyProductIncludes(row, include, db);
}

/** Order line items carry orderId+productId+quantity - hydrate the catalog
 * snapshot (restoreStock and friends walk items with include.product). */
function applyOrderItemProductInclude(row: Row, include: Record<string, unknown> | undefined, db: InMemoryDb): void {
  if (include?.product && row.productId !== undefined && row.quantity !== undefined) {
    row.product = db.product.find((p) => p.id === row.productId) ?? null;
  }
}

/** Product catalog relations (products module v2) - rows carry sku+storeId. */
function applyProductIncludes(row: Row, include: Record<string, unknown> | undefined, db: InMemoryDb): void {
  if (row.sku === undefined || row.storeId === undefined) return;
  if (include?.variants) {
    row.variants = db.productVariant.filter((v) => v.productId === row.id && !v.deletedAt);
  }
  if (include?.imageAssets) {
    row.imageAssets = db.productImage
      .filter((i) => i.productId === row.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }
  if (include?.discounts) {
    row.discounts = db.productDiscount.filter((d) => d.productId === row.id);
  }
  if (include?.category && row.categoryId) {
    row.category = db.category.find((c) => c.id === row.categoryId) ?? null;
  }
  if (include?.tagLinks) {
    row.tagLinks = db.productTagOnProduct
      .filter((l) => l.productId === row.id)
      .map((l) => ({ ...l, tag: db.productTag.find((t) => t.id === l.tagId) ?? null }));
  }
}

/** Order commerce relations - rows carry orderNumber+storeId. */
function applyOrderIncludes(row: Row, include: Record<string, unknown> | undefined, db: InMemoryDb): void {
  if (row.orderNumber === undefined || row.storeId === undefined) return;
  if (include?.items) {
    row.items = db.orderItem.filter((i) => i.orderId === row.id);
  }
  if (include?.statusHistory) {
    row.statusHistory = db.orderStatusHistory
      .filter((h) => h.orderId === row.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  if (include?.orderNotes) {
    row.orderNotes = db.orderNote.filter((n) => n.orderId === row.id);
  }
  if (include?.refunds) {
    row.refunds = db.orderRefund.filter((r) => r.orderId === row.id);
  }
  if (include?.cancellationRecord) {
    row.cancellationRecord = db.orderCancellation.find((c) => c.orderId === row.id) ?? null;
  }
  if (include?.customer && row.customerId) {
    const c = db.customer.find((x) => x.id === row.customerId);
    row.customer = c ? { id: c.id, name: c.name, waPhone: c.waPhone } : null;
  }
}

/** merchant.create({data:{..., users:{create:{...}}}}) -> merchant with users attached. */
function decorate(row: Row | null, _orderBy: unknown, include?: Record<string, unknown>): Row | null {
  if (!row) return null;
  const db = getInMemoryDb();
  if (row.companyName !== undefined && include?.users) {
    row.users = db.user.filter((u) => u.merchantId === row.id);
  }
  if (include?.merchant) {
    row.merchant = db.merchant.find((m) => m.id === row.merchantId) ?? null;
  }
  applyRelationIncludes(row, include, db);
  applyOrderIncludes(row, include, db);
  return row;
}

export const inMemoryModels = {
  merchant: () => makeDelegate((db) => db.merchant, 'merchant'),
  user: () => makeDelegate((db) => db.user, 'user'),
  refreshToken: () => makeDelegate((db) => db.refreshToken, 'refreshToken'),
  store: () => makeDelegate((db) => db.store, 'store'),
  apiToken: () => makeDelegate((db) => db.apiToken, 'apiToken'),
  product: () => makeDelegate((db) => db.product, 'product'),
  order: () => makeDelegate((db) => db.order, 'order'),
    conversation: () => makeDelegate((db) => db.conversation, 'conversation'),
    message: () => makeDelegate((db) => db.message, 'message'),
    messageAttachment: () => makeDelegate((db) => db.messageAttachment, 'messageAttachment'),
    messageEscalation: () => makeDelegate((db) => db.messageEscalation, 'messageEscalation'),
    aiIntent: () => makeDelegate((db) => db.aiIntent, 'aiIntent'),
    aiConfiguration: () => makeDelegate((db) => db.aiConfiguration, 'aiConfiguration'),
    aiResponseLog: () => makeDelegate((db) => db.aiResponseLog, 'aiResponseLog'),
  campaign: () => makeDelegate((db) => db.campaign, 'campaign'),
  campaignMessage: () => makeDelegate((db) => db.campaignMessage, 'campaignMessage'),
  payment: () => makeDelegate((db) => db.payment, 'payment'),
  delivery: () => makeDelegate((db) => db.delivery, 'delivery'),
  auditLog: () => makeDelegate((db) => db.auditLog, 'auditLog'),
  outboxEvent: () => makeDelegate((db) => db.outboxEvent, 'outboxEvent'),
  dailyStoreMetric: () => makeDelegate((db) => db.dailyStoreMetric, 'dailyStoreMetric'),
  passwordReset: () => makeDelegate((db) => db.passwordReset, 'passwordReset'),
  emailVerification: () => makeDelegate((db) => db.emailVerification, 'emailVerification'),
  phoneVerification: () => makeDelegate((db) => db.phoneVerification, 'phoneVerification'),
  twoFactorSecret: () => makeDelegate((db) => db.twoFactorSecret, 'twoFactorSecret'),
  oauthAccount: () => makeDelegate((db) => db.oauthAccount, 'oauthAccount'),
  sellerProfile: () => makeDelegate((db) => db.sellerProfile, 'sellerProfile'),
  adminProfile: () => makeDelegate((db) => db.adminProfile, 'adminProfile'),
  whatsAppConnection: () => makeDelegate((db) => db.whatsappConnection, 'whatsappConnection'),
  merchantDeliveryProvider: () => makeDelegate((db) => db.merchantDeliveryProvider, 'merchantDeliveryProvider'),
  paymentMethod: () => makeDelegate((db) => db.paymentMethod, 'paymentMethod'),
  deliveryProvider: () => makeDelegate((db) => db.deliveryProvider, 'deliveryProvider'),
  subscriptionPlan: () => makeDelegate((db) => db.subscriptionPlan, 'subscriptionPlan'),
  subscription: () => makeDelegate((db) => db.subscription, 'subscription'),
  customer: () => makeDelegate((db) => db.customer, 'customer'),
  customerTag: () => makeDelegate((db) => db.customerTag, 'customerTag'),
  customerNote: () => makeDelegate((db) => db.customerNote, 'customerNote'),
  customerSegment: () => makeDelegate((db) => db.customerSegment, 'customerSegment'),
  customerSegmentMember: () => makeDelegate((db) => db.customerSegmentMember, 'customerSegmentMember'),
  category: () => makeDelegate((db) => db.category, 'category'),
  productVariant: () => makeDelegate((db) => db.productVariant, 'productVariant'),
  productImage: () => makeDelegate((db) => db.productImage, 'productImage'),
  productDiscount: () => makeDelegate((db) => db.productDiscount, 'productDiscount'),
  productTag: () => makeDelegate((db) => db.productTag, 'productTag'),
  productTagOnProduct: () => makeDelegate((db) => db.productTagOnProduct, 'productTagOnProduct'),
  inventoryLedger: () => makeDelegate((db) => db.inventoryLedger, 'inventoryLedger'),
  priceSuggestion: () => makeDelegate((db) => db.priceSuggestion, 'priceSuggestion'),
  orderItem: () => makeDelegate((db) => db.orderItem, 'orderItem'),
  orderStatusHistory: () => makeDelegate((db) => db.orderStatusHistory, 'orderStatusHistory'),
  orderNote: () => makeDelegate((db) => db.orderNote, 'orderNote'),
  orderRefund: () => makeDelegate((db) => db.orderRefund, 'orderRefund'),
  orderCancellation: () => makeDelegate((db) => db.orderCancellation, 'orderCancellation'),
  paymentTransaction: () => makeDelegate((db) => db.paymentTransaction, 'paymentTransaction'),
  paymentWebhook: () => makeDelegate((db) => db.paymentWebhook, 'paymentWebhook'),
};

/**
 * A prisma-shaped client over the SAME in-memory arrays - handed to
 * interactive $transaction callbacks. Safe to reference from runtime code
 * even though it is declared after createInMemoryDb (TDZ only applies during
 * module evaluation, and $transaction only runs inside tests).
 */
function makeTransactionClient(db: InMemoryDb): Record<string, unknown> {
  return new Proxy({ __db: db }, {
    get(target, prop: string) {
      if (prop === '__db') return target.__db;
      if (prop === '$queryRaw') return target.__db.$queryRaw;
      const models = inMemoryModels as Record<string, (() => unknown) | undefined>;
      const maker = models[prop];
      return maker ? maker() : undefined;
    },
  });
}

/** Factory consumed inside jest.mock('.../lib/prisma.js') hoisted factories. */
export function makePrismaExports(db: InMemoryDb = getInMemoryDb()): Record<string, unknown> {
  return {
    prisma: new Proxy({ __db: db }, {
      get(target, prop: string) {
        if (prop === '__db') return target.__db;
        if (prop === '$transaction') return target.__db.$transaction;
        if (prop === '$queryRaw') return target.__db.$queryRaw;
        if (prop === '$disconnect') return target.__db.$disconnect;
        if (prop === '$use') return (_cb: unknown) => undefined;
        const models = inMemoryModels as Record<string, (() => unknown) | undefined>;
        const maker = models[prop];
        return maker ? maker() : undefined;
      },
    }),
    checkDatabaseHealth: async () => dbHealthy,
    disconnectDatabase: async () => undefined,
  };
}
