# GraphQL

> REST is canonical for mutations and third-party integrations; GraphQL serves the
> dashboard's aggregation reads where four REST calls would be one round trip too many.
> Endpoint: `POST /api/v1/graphql` (Apollo Server 4 embedded in backend-api).

---

## 1. When to use which

| Need | Use |
|---|---|
| CRUD, integrations, webhooks, SDKs | REST (openapi.yaml = source of truth) |
| Dashboard composite views, field trimming, rapid UI iteration | GraphQL |
| File upload / streaming | REST |
| Public partner API | REST only (stable contracts, cacheability) |

## 2. Design rules

1. **Schema-first discipline via codegen**: SDL is generated from resolvers and
   committed (`schema.graphql`); breaking changes gated by `graphql-inspector` in CI —
   same policy as oasdiff for REST.
2. **No direct entity exposure**: every root resolver maps to an authorized use-case;
   object-level authz reuses TenantContext (a `store(id:)` for a foreign store → error).
3. **Complexity budget**: query cost = depth×2 + list sizes; default max 300,
   introspection depth 4. Exceeding → 400 with `errors[0].extensions.code='COST_LIMIT'`.
4. **Pagination**: Relay-style connections (`first/after/last/before`) over the same
   cursor implementation as REST — identical ordering guarantees.
5. **Errors**: partial data + `errors[]` with `extensions.code` mirroring the REST
   error catalog (`NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`…).
6. **Persisted queries** for the production dashboards (APQ); ad-hoc queries allowed
   for authenticated API-key principals only.

## 3. Core schema (excerpt)

```graphql
type Query {
  me: Me!
  store(id: ID!): Store!
  orders(first: Int = 20, after: String, status: [OrderStatus!]): OrderConnection!
  customers(first: Int, after: String, segment: String, q: String): CustomerConnection!
  product(id: ID!): Product!
  dashboard(storeId: ID!, range: DateRange!, timezone: String): DashboardStats!
}

type DashboardStats {
  revenue: MoneyString!
  ordersCount: Int!
  newCustomers: Int!
  aiResolutionRate: Float!
  conversionRate: Float!
  revenueSeries: [DayPoint!]!
  topProducts(limit: Int = 5): [ProductSales!]!
  recentOrders(limit: Int = 8): [Order!]!
}

type Order {
  id: ID!
  orderNumber: String!
  status: OrderStatus!
  total: MoneyString!          # "1500.50"
  currency: Currency!
  createdAt: DateTime!
  customer: Customer!
  items: [OrderItem!]!
  delivery: Delivery
  payment: Payment
}

type Mutation {                 # thin surface: writes stay REST-canonical
  markThreadRead(threadId: ID!): Boolean!
}
```

Mutations are deliberately minimal: anything state-changing that partners or webhooks
need lives in REST so there is exactly one write contract to secure/idempotency-guard.

## 4. Example queries

Dashboard landing (replaces 4 REST calls):

```graphql
query Dashboard($storeId: ID!) {
  dashboard(storeId: $storeId, range: last7days, timezone: "Africa/Lagos") {
    revenue ordersCount aiResolutionRate
    revenueSeries { date value }
    topProducts(limit: 5) { id name units revenue }
    recentOrders(limit: 8) { id orderNumber status total createdAt customer { name } }
  }
}
```

Order 360 with field selection and connection paging:

```graphql
query Orders($first: Int!, $after: String) {
  orders(first: $first, after: $after, status: [PAID, PROCESSING]) {
    edges { node { id orderNumber total customer { name } delivery { carrier status } } }
    pageInfo { hasNextPage endCursor }
  }
}
```

Error shape:

```json
{
  "data": { "order": null },
  "errors": [{ "message": "Order not found",
               "extensions": { "code": "NOT_FOUND", "requestId": "req_01HQ…" } }]
}
```

## 5. Execution internals

- DataLoader per-request instances batch entity loads (`customer`, `delivery`) → kills N+1.
- Auth: same guards as REST run ahead of Apollo (JWT/API-key), then per-field checks
  where roles differ (e.g., `Payment.accountNumberLast4` visible only to OWNER+).
- Caching: APQ hash cache in Redis; response caching disabled by default (per-user data)
  except shared fragments like plan catalog.
- Tracing: Apollo plugin emits OTel spans per resolver; slow-resolver log at >50 ms.

## 6. Governance

- Schema PRs require: inspector clean-diff, complexity estimate for new roots,
  updated `schema.graphql`, changelog entry.
- Client usage tracked via operation signatures (APQ registry) — unused fields
  deprecated quarterly, keeping the schema lean.
