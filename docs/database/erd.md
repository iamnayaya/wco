# WCO Entity-Relationship Diagram & Relationship Catalog

## 1. ERD (Mermaid)

```mermaid
erDiagram
    %% ---------- Identity & Tenancy ----------
    MERCHANT ||--o{ USER : "employs"
    MERCHANT ||--o{ STORE : "owns"
    MERCHANT ||--o{ API_TOKEN : "issues"
    MERCHANT ||--o| PAYMENT_METHOD : "payout accounts"
    MERCHANT ||--o| SUBSCRIPTION : "bills"
    USER ||--o{ REFRESH_TOKEN : "authenticates"
    USER |o--o{ CONVERSATION : "assigned agent"

    %% ---------- Billing ----------
    SUBSCRIPTION_PLAN ||--o{ SUBSCRIPTION : "priced by"

    %% ---------- Catalog ----------
    STORE ||--o{ CATEGORY : ""
    STORE ||--o{ PRODUCT : ""
    STORE ||--o{ CUSTOMER : ""
    STORE ||--o{ ORDER : ""
    STORE ||--o{ PAYMENT : ""
    STORE ||--o{ DELIVERY : ""
    STORE ||--o{ CONVERSATION : ""
    STORE ||--|| AI_CONFIGURATION : ""
    STORE ||--o{ AI_RESPONSE_TEMPLATE : ""
    CATEGORY |o--o{ PRODUCT : "groups"
    PRODUCT ||--o{ PRODUCT_VARIANT : "has"
    PRODUCT ||--o{ ORDER_ITEM : "sold as"
    PRODUCT ||--o{ PRICE_SUGGESTION : ""
    PRODUCT ||--o{ DEMAND_FORECAST : ""

    %% ---------- Commerce ----------
    CUSTOMER ||--o{ ORDER : "places"
    ORDER ||--|{ ORDER_ITEM : "contains"
    ORDER ||--o| PAYMENT : "settled by"
    ORDER ||--o| DELIVERY : "fulfilled by"
    ORDER_ITEM }o--o| PRODUCT_VARIANT : "variant of"
    PAYMENT_METHOD {
        string accountNumberEnc AES256GCM
    }

    %% ---------- Logistics ----------
    DELIVERY_PROVIDER ||--o{ DELIVERY : "operates"

    %% ---------- Messaging ----------
    CONVERSATION ||--o{ MESSAGE : "thread contains"
    CUSTOMER ||--|| CONVERSATION : "one thread per store-customer"

    %% ---------- Growth & AI ----------
    CAMPAIGN ||--o{ CAMPAIGN_MESSAGE : "fan-out"
    CUSTOMER ||--o{ CAMPAIGN_MESSAGE : "targeted"
    AUTOMATION_RULE }o--|| STORE : ""

    %% ---------- Platform ----------
    STORE ||--o{ ANALYTICS_EVENT : "emits"
    STORE ||--o{ DAILY_STORE_METRIC : "rollup"
    STORE ||--o{ WEBHOOK_SUBSCRIPTION : "notifies"
    STORE |o--o{ AUDIT_LOG : "audited"
```

## 2. Relationship catalog

### 2.1 One-to-one

| Parent | Child | FK | On delete | Rationale |
|---|---|---|---|---|
| `orders` | `payments` | `payments.orderId` UNIQUE | SET NULL | Payment can out-live an order row in pay-first flows |
| `orders` | `deliveries` | `deliveries.orderId` UNIQUE | RESTRICT | An order with a booked delivery cannot be silently deleted |
| `stores` | `ai_configurations` | `ai_configurations.storeId` UNIQUE | CASCADE | Exactly one AI brain per store |

### 2.2 One-to-many (core)

| Parent | Child | On delete | Notes |
|---|---|---|---|
| `merchants` → `users` / `stores` / `api_tokens` / `payment_methods` / `subscriptions` | CASCADE | Tenant root owns everything |
| `stores` → `categories/products/customers/orders/...` | CASCADE | Store deletion wipes its slice (GDPR erasure path) |
| `products` → `product_variants` | CASCADE | Variants are meaningless without the parent |
| `orders` → `order_items` | CASCADE | Line items die with the order |
| `conversations` → `messages` | CASCADE | Thread history dies with thread |
| `customers` → `orders` | **RESTRICT** | Never orphan money history; erasure runs the GDPR flow instead |
| `subscription_plans` → `subscriptions` | **RESTRICT** | Historical subs must keep resolving their plan version |
| `delivery_providers` → `deliveries` | SET NULL | Provider offboarding must not break delivery history (`carrier` snapshot column keeps display data) |
| `users` → `conversations.assignedUserId` | SET NULL | Agent deactivation reassigns threads to bot queue |
| `stores` → `audit_logs.storeId` | SET NULL | Audit trail survives store deletion (compliance) |

### 2.3 Many-to-many — none materialized directly

The only conceptual N:M (customers ↔ campaigns) is resolved through
`campaign_messages`, which is a first-class entity because it carries
per-delivery state machine data (`status`, `messageId`, `errorReason`). That's
the correct decomposition: junction tables earn their existence when they hold
attributes.

## 3. Query cookbook

All examples assume tenant scoping via `TenantContext`; raw SQL shown for clarity.

### 3.1 Order detail — the canonical 5-way JOIN

```sql
SELECT o.*, c.name AS customer_name, c."waPhone",
       p.provider, p.status AS payment_status, p."providerReference",
       d.carrier, d.status AS delivery_status, d."trackingCode",
       jsonb_agg(jsonb_build_object(
           'name', oi."productName", 'variant', oi."variantName",
           'sku', oi.sku, 'qty', oi.quantity, 'unitPrice', oi."unitPrice"
       ) ORDER BY oi.id) AS items
FROM orders o
JOIN customers  c  ON c.id  = o."customerId"
LEFT JOIN payments   p  ON p."orderId" = o.id
LEFT JOIN deliveries d  ON d."orderId" = o.id
JOIN order_items     oi ON oi."orderId" = o.id
WHERE o.id = $1 AND o."storeId" = $2      -- tenant scope FIRST for planner pruning
GROUP BY o.id, c.name, c."waPhone", p.provider, p.status, p."providerReference",
         d.carrier, d.status, d."trackingCode";
```

Prisma equivalent uses `include: { customer, payment, delivery, items }`
(see `apps/backend/src/modules/orders/orders.repository.ts`).

### 3.2 Revenue per day per store — rollup source query

```sql
SELECT s.id, m.date,
       SUM(o.total)                       FILTER (WHERE o.status IN ('PAID','DELIVERED')) AS revenue,
       COUNT(*)                           FILTER (WHERE o.status <> 'CANCELLED')          AS orders,
       COUNT(DISTINCT o."customerId")                                                      AS buyers
FROM orders o
JOIN stores s ON s.id = o."storeId"
CROSS JOIN LATERAL date_trunc('day', o."paidAt") m(date)
WHERE o."createdAt" >= now() - INTERVAL '30 days'
GROUP BY s.id, m.date;
```

In production this never touches OLTP at read time: ClickHouse serves it from
CDC; Timescale continuous aggregates serve it when ClickHouse is unavailable.

### 3.3 Top products by revenue (snapshot prices honored)

```sql
SELECT oi."productName", oi.sku,
       SUM(oi.quantity)                    AS units,
       SUM(oi.quantity * oi."unitPrice")   AS gross
FROM order_items oi
JOIN orders o ON o.id = oi."orderId"
WHERE o."storeId" = $1 AND o.status IN ('PAID','PROCESSING','SHIPPED','DELIVERED')
  AND o."createdAt" >= date_trunc('month', now())
GROUP BY 1, 2
ORDER BY gross DESC
LIMIT 20;
```

Note we aggregate `order_items.unitPrice` snapshots — catalog price edits never
rewrite sales history.

### 3.4 Abandoned-cart candidates (automation trigger feed)

```sql
SELECT DISTINCT c.id, c."waPhone", c.name
FROM conversations cv
JOIN messages m  ON m."conversationId" = cv.id AND m.direction = 'INBOUND'
JOIN customers c ON c.id = cv."customerId"
WHERE cv."storeId" = $1
  AND m."createdAt" >= now() - INTERVAL '24 hours'
  AND NOT EXISTS (                                  -- no outbound reply yet
        SELECT 1 FROM messages om
        WHERE om."conversationId" = cv.id
          AND om.direction = 'OUTBOUND'
          AND om."createdAt" > m."createdAt")
  AND NOT EXISTS (                                  -- and they didn't already buy
        SELECT 1 FROM orders o
        WHERE o."customerId" = c.id AND o."createdAt" >= m."createdAt");
```

Runs as a KEDA cron worker; results enqueue cart-rescue automation jobs.

### 3.5 Customer lifetime value + segment refresh (nightly segmentation)

```sql
WITH ltv AS (
    SELECT cu.id,
           COALESCE(SUM(o.total), 0)                                   AS spent,
           COUNT(o.id)                                                 AS orders_cnt,
           MAX(o."createdAt")                                          AS last_order_at
    FROM customers cu
    LEFT JOIN orders o ON o."customerId" = cu.id
                      AND o.status IN ('PAID','PROCESSING','SHIPPED','DELIVERED')
    WHERE cu."storeId" = $1
    GROUP BY cu.id
)
UPDATE customers cu
SET "totalSpent"  = ltv.spent,
    "ordersCount" = ltv.orders_cnt,
    "lastOrderAt" = ltv.last_order_at,
    segment = CASE
        WHEN ltv.spent >= 250000 THEN 'VIP'
        WHEN ltv.orders_cnt >= 3 THEN 'REPEAT'
        WHEN ltv.last_order_at < now() - INTERVAL '60 days' THEN 'CHURN_RISK'
        ELSE 'NEW' END,
    "updatedAt" = now()
FROM ltv WHERE ltv.id = cu.id;
```

Batched by store id; each UPDATE batch ≤ 10k rows to keep replica lag sane.

### 3.6 Conversation hand-off funnel (conversion analytics)

```sql
SELECT cv.status,
       COUNT(*)                                                        AS threads,
       COUNT(o.id)                                                     AS became_orders,
       ROUND(COUNT(o.id)::numeric / NULLIF(COUNT(*),0), 4)             AS conversion
FROM conversations cv
LEFT JOIN orders o ON o."customerId" = cv."customerId" AND o."storeId" = cv."storeId"
WHERE cv."storeId" = $1 AND cv."lastMessageAt" >= now() - INTERVAL '7 days'
GROUP BY cv.status;
```

### 3.7 Subquery pattern — products never ordered (catalog dead weight)

```sql
SELECT p.sku, p.name, p."stockQuantity"
FROM products p
WHERE p."storeId" = $1 AND p."deletedAt" IS NULL
  AND p.id NOT IN (SELECT oi."productId" FROM order_items oi
                   JOIN orders o ON o.id = oi."orderId"
                   WHERE o."storeId" = $1 AND o."createdAt" >= now() - INTERVAL '90 days')
ORDER BY p."stockQuantity" DESC;
```

## 4. Referential integrity guarantees worth knowing

1. `orders_total_math_check` — the DB rejects any write where
   `total ≠ subtotal − discount + deliveryFee`. Money math bugs surface as
   constraint violations, not silent drift.
2. `subscriptions_one_live_per_merchant_uidx` (partial unique, migration 0002)
   — impossible to double-bill a merchant.
3. `payments_providerReference_key` — PSP webhook replays upsert, never
   duplicate.
4. `messages_waMessageId_key` — provider retries dedupe at the DB layer.
5. E.164 CHECKs on `stores.whatsappNumber` / `customers.waPhone` /
   `deliveries.recipientPhone` — malformed phone numbers can't enter chat
   routing paths.
