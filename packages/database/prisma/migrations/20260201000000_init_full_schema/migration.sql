-- =============================================================================
-- WCO — WhatsApp Commerce OS · 0001 · Initial full schema
-- =============================================================================
-- Source of truth: packages/database/prisma/schema.prisma
-- Conventions
--   * IDs            TEXT (cuid2, generated application-side — no DB default)
--   * Timestamps     TIMESTAMP(3), always written/read as UTC.
--                    Every role is pinned to UTC (see 0002) and Prisma sends
--                    ISO-8601 UTC; never rely on session-local wall clocks.
--   * Money          DECIMAL(14,2) + ISO currency column. Never floats.
--   * Tenancy        Every business row carries "storeId" (or merchantId at
--                    merchant scope). RLS policies in migration 0002.
--   * Naming         snake_case tables (@@map); Prisma-native camelCase
--                    columns, quoted. Constraint names follow Prisma's
--                    {table}_{cols}_{fkey|key|idx} convention so future
--                    `prisma migrate dev` diffs stay clean.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions (idempotent; requires superuser or rds superuser flag)
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy search fallback under ES
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- digest()/hmac() for token hashing

-- =============================================================================
-- ENUMS
-- =============================================================================
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'AGENT', 'VIEWER');
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'SCALE');
CREATE TYPE "StoreStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'DRAFT', 'OUT_OF_STOCK', 'ARCHIVED');
CREATE TYPE "Currency" AS ENUM ('NGN', 'GHS', 'KES', 'ZAR', 'XOF', 'USD');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "OrderChannel" AS ENUM ('WHATSAPP', 'DASHBOARD', 'PAYMENT_LINK');
CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'FLUTTERWAVE', 'OPAY', 'BANK_TRANSFER', 'CASH');
CREATE TYPE "PaymentStatus" AS ENUM ('INITIALIZED', 'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'ABANDONED');
CREATE TYPE "LogisticsCarrier" AS ENUM ('GIG', 'KWIK', 'SENDY', 'MANUAL');
CREATE TYPE "DeliveryStatus" AS ENUM ('QUOTED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'LOCATION', 'TEMPLATE', 'INTERACTIVE');
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED');
CREATE TYPE "ConversationStatus" AS ENUM ('BOT', 'HANDLED', 'CLOSED');
CREATE TYPE "CampaignType" AS ENUM ('ABANDONED_CART', 'FOLLOW_UP', 'PROMOTION', 'WINBACK', 'REVIEW_REQUEST');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED');
CREATE TYPE "AutomationTrigger" AS ENUM ('ORDER_PAID', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'CART_ABANDONED', 'NEW_CUSTOMER', 'FOLLOW_UP_DUE', 'KEYWORD');
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');
CREATE TYPE "PaymentMethodType" AS ENUM ('BANK_ACCOUNT', 'MOBILE_MONEY', 'USSD', 'CARD');
CREATE TYPE "PayoutVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "AiTone" AS ENUM ('FRIENDLY', 'PROFESSIONAL', 'PLAYFUL', 'CONCISE');
CREATE TYPE "AiTemplateCategory" AS ENUM ('GREETING', 'PRICE_INQUIRY', 'ORDER_CONFIRMATION', 'SHIPPING_INFO', 'PAYMENT_REMINDER', 'ABANDONED_CART', 'OUT_OF_STOCK', 'REVIEW_REQUEST', 'ESCALATION', 'CUSTOM');

-- =============================================================================
-- IDENTITY & TENANCY
-- =============================================================================

-- Root of tenancy: one merchant (company) owns stores, users, payout methods
-- and exactly one live subscription (enforced in 0002).
CREATE TABLE "merchants" (
    "id"                   TEXT        NOT NULL,
    "companyName"          TEXT        NOT NULL,
    "email"                TEXT        NOT NULL,
    "phone"                TEXT,
    "country"              TEXT        NOT NULL DEFAULT 'NG',
    "plan"                 "PlanTier"  NOT NULL DEFAULT 'FREE',
    "planExpiresAt"        TIMESTAMP(3),
    "settings"             JSONB       NOT NULL DEFAULT '{}'::jsonb,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "merchants_email_key" ON "merchants"("email");
COMMENT ON TABLE  "merchants" IS 'Tenant root: company account. Owns stores/users/payouts/subscriptions.';
COMMENT ON COLUMN "merchants"."plan" IS 'Denormalized current tier for fast gating; authoritative state lives in subscriptions.';

CREATE TABLE "users" (
    "id"           TEXT         NOT NULL,
    "merchantId"   TEXT         NOT NULL,
    "email"        TEXT         NOT NULL,
    "fullName"     TEXT         NOT NULL,
    "passwordHash" TEXT,                      -- argon2id; NULL ⇒ SSO-only user
    "role"         "UserRole"   NOT NULL DEFAULT 'OWNER',
    "isActive"     BOOLEAN      NOT NULL DEFAULT true,
    "settings"     JSONB        NOT NULL DEFAULT '{}'::jsonb,
    "lastLoginAt"  TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "users_merchantId_email_key" ON "users"("merchantId", "email");
CREATE INDEX "users_merchantId_idx" ON "users"("merchantId");
COMMENT ON COLUMN "users"."role" IS 'OWNER>ADMIN>AGENT>VIEWER — maps to permission scopes in TenantGuard.';
COMMENT ON COLUMN "users"."passwordHash" IS 'argon2id encoded hash. Plaintext passwords are never stored or logged.';

CREATE TABLE "refresh_tokens" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "tokenHash" TEXT         NOT NULL,        -- SHA-256 of opaque refresh token
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ip"        TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");
COMMENT ON COLUMN "refresh_tokens"."tokenHash" IS 'Only the hash is stored — a stolen DB cannot mint sessions.';
COMMENT ON INDEX  "refresh_tokens_expiresAt_idx" IS 'Nightly sweeper deletes expired/revoked rows via this index.';

-- Machine-to-machine credentials for the public API (scoped to a merchant).
CREATE TABLE "api_tokens" (
    "id"         TEXT         NOT NULL,
    "merchantId" TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "prefix"     TEXT         NOT NULL,       -- display prefix e.g. wco_live_a1b2
    "tokenHash"  TEXT         NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt"  TIMESTAMP(3),
    "revokedAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "api_tokens_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "api_tokens_tokenHash_key" ON "api_tokens"("tokenHash");
CREATE INDEX "api_tokens_merchantId_idx" ON "api_tokens"("merchantId");

-- =============================================================================
-- BILLING — plans, subscriptions, payout methods
-- =============================================================================

-- Plan catalog. Price changes insert NEW rows; historical subscriptions keep
-- referencing the plan version they signed up on (FK is RESTRICT).
CREATE TABLE "subscription_plans" (
    "id"           TEXT           NOT NULL,
    "code"         TEXT           NOT NULL,   -- FREE | STARTER | GROWTH | SCALE
    "name"         TEXT           NOT NULL,
    "description"  TEXT,
    "priceMonthly" DECIMAL(10,2)  NOT NULL,
    "priceYearly"  DECIMAL(10,2)  NOT NULL,
    "currency"     "Currency"     NOT NULL DEFAULT 'NGN',
    "trialDays"    INTEGER        NOT NULL DEFAULT 0,
    "limits"       JSONB          NOT NULL DEFAULT '{}'::jsonb,
    "features"     TEXT[]         NOT NULL DEFAULT '{}'::text[],
    "isActive"     BOOLEAN        NOT NULL DEFAULT true,
    "sortOrder"    INTEGER        NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)   NOT NULL,
    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscription_plans_price_nonneg_check" CHECK ("priceMonthly" >= 0 AND "priceYearly" >= 0),
    CONSTRAINT "subscription_plans_trial_range_check" CHECK ("trialDays" BETWEEN 0 AND 90)
);
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");
COMMENT ON COLUMN "subscription_plans"."limits" IS 'e.g. {"ordersPerMonth":1000,"aiCredits":5000,"stores":3,"users":5,"products":500}';
COMMENT ON TABLE  "subscription_plans" IS 'Immutable-ish catalog seeded by platform ops.';

CREATE TABLE "subscriptions" (
    "id"                 TEXT                 NOT NULL,
    "merchantId"         TEXT                 NOT NULL,
    "planId"             TEXT                 NOT NULL,
    "status"             "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billingCycle"       "BillingCycle"       NOT NULL DEFAULT 'MONTHLY',
    "amount"             DECIMAL(10,2)        NOT NULL, -- locked-in price at signup/renewal
    "currency"           "Currency"           NOT NULL DEFAULT 'NGN',
    "currentPeriodStart" TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd"   TIMESTAMP(3)         NOT NULL,
    "trialEndsAt"        TIMESTAMP(3),
    "cancelAtPeriodEnd"  BOOLEAN              NOT NULL DEFAULT false,
    "cancelledAt"        TIMESTAMP(3),
    "providerReference"  TEXT,                     -- PSP subscription/customer code
    "meta"               JSONB                NOT NULL DEFAULT '{}'::jsonb,
    "createdAt"          TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)         NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "subscriptions_period_order_check" CHECK ("currentPeriodEnd" > "currentPeriodStart"),
    CONSTRAINT "subscriptions_amount_nonneg_check" CHECK ("amount" >= 0),
    CONSTRAINT "subscriptions_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "subscriptions_merchantId_idx" ON "subscriptions"("merchantId");
CREATE INDEX "subscriptions_status_currentPeriodEnd_idx" ON "subscriptions"("status", "currentPeriodEnd");
CREATE INDEX "subscriptions_trialEndsAt_idx" ON "subscriptions"("trialEndsAt");
COMMENT ON TABLE  "subscriptions" IS 'Billing relationship per merchant. At most one ACTIVE/TRIALING row per merchant — partial unique index in 0002.';
COMMENT ON COLUMN "subscriptions"."amount" IS 'Snapshot of price actually charged; plan rows may change later.';

-- Seller payout destinations. Ciphertext-only storage for account numbers.
CREATE TABLE "payment_methods" (
    "id"                 TEXT                       NOT NULL,
    "merchantId"         TEXT                       NOT NULL,
    "type"               "PaymentMethodType"        NOT NULL,
    "providerName"       TEXT                       NOT NULL, -- GTBank | OPay | M-Pesa | MTN MoMo …
    "accountName"        TEXT                       NOT NULL,
    "accountNumberEnc"   TEXT                       NOT NULL, -- AES-256-GCM ciphertext (app layer)
    "accountNumberLast4" TEXT                       NOT NULL, -- display-only digits
    "accountNumberHash"  TEXT                       NOT NULL, -- HMAC-SHA256 — dedupe/search w/o decryption
    "bankCode"           TEXT,
    "isDefault"          BOOLEAN                    NOT NULL DEFAULT false,
    "verificationStatus" "PayoutVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt"         TIMESTAMP(3),
    "meta"               JSONB                      NOT NULL DEFAULT '{}'::jsonb,
    "createdAt"          TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)               NOT NULL,
    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_methods_last4_format_check" CHECK ("accountNumberLast4" ~ '^[0-9]{4}$'),
    CONSTRAINT "payment_methods_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "payment_methods_merchantId_accountNumberHash_key" ON "payment_methods"("merchantId", "accountNumberHash");
CREATE INDEX "payment_methods_merchantId_idx" ON "payment_methods"("merchantId");
COMMENT ON COLUMN "payment_methods"."accountNumberEnc" IS 'AES-256-GCM envelope encrypted with KMS-wrapped key. NEVER store plaintext.';
COMMENT ON COLUMN "payment_methods"."accountNumberHash" IS 'HMAC-SHA256(accountNumber) — uniqueness + lookup without decryption.';

-- =============================================================================
-- CATALOG
-- =============================================================================

CREATE TABLE "stores" (
    "id"             TEXT          NOT NULL,
    "merchantId"     TEXT          NOT NULL,
    "name"           TEXT          NOT NULL,
    "description"    TEXT,
    "slug"           TEXT          NOT NULL,   -- public storefront URL key
    "whatsappNumber" TEXT,                        -- E.164; routing key for webhooks
    "whatsappNameId" TEXT,                         -- Meta phone_number_id
    "currency"       "Currency"    NOT NULL DEFAULT 'NGN',
    "timezone"       TEXT          NOT NULL DEFAULT 'Africa/Lagos',
    "address"        TEXT,
    "city"           TEXT,
    "country"        TEXT          NOT NULL DEFAULT 'NG',
    "status"         "StoreStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings"       JSONB         NOT NULL DEFAULT '{}'::jsonb,
    "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "stores_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stores_whatsapp_e164_check" CHECK ("whatsappNumber" IS NULL OR "whatsappNumber" ~ '^\+[1-9][0-9]{6,14}$'),
    CONSTRAINT "stores_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "stores_slug_key" ON "stores"("slug");
CREATE UNIQUE INDEX "stores_whatsappNumber_key" ON "stores"("whatsappNumber");
CREATE INDEX "stores_merchantId_idx" ON "stores"("merchantId");
COMMENT ON COLUMN "stores"."whatsappNumber" IS 'Unique across platform — inbound webhook routes by this number.';
COMMENT ON TABLE  "stores" IS 'Primary tenant scope: every business table hangs off storeId.';

CREATE TABLE "categories" (
    "id"        TEXT        NOT NULL,
    "storeId"   TEXT        NOT NULL,
    "name"      TEXT        NOT NULL,
    "sortOrder" INTEGER     NOT NULL DEFAULT 0,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "categories_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "categories_storeId_name_key" ON "categories"("storeId", "name");

CREATE TABLE "products" (
    "id"                TEXT           NOT NULL,
    "storeId"           TEXT           NOT NULL,
    "categoryId"        TEXT,
    "sku"               TEXT           NOT NULL,
    "name"              TEXT           NOT NULL,
    "description"       TEXT,
    "price"             DECIMAL(14,2)  NOT NULL,
    "compareAtPrice"    DECIMAL(14,2),
    "costPrice"         DECIMAL(14,2),
    "stockQuantity"     INTEGER        NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER        NOT NULL DEFAULT 5,
    "trackStock"        BOOLEAN        NOT NULL DEFAULT true,
    "images"            TEXT[]         NOT NULL DEFAULT '{}'::text[],
    "status"            "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "attributes"        JSONB          NOT NULL DEFAULT '{}'::jsonb,
    "deletedAt"         TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)   NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_price_nonneg_check" CHECK ("price" >= 0),
    CONSTRAINT "products_compare_at_check" CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" >= "price"),
    CONSTRAINT "products_cost_nonneg_check" CHECK ("costPrice" IS NULL OR "costPrice" >= 0),
    CONSTRAINT "products_stock_nonneg_check" CHECK ("stockQuantity" >= 0),
    CONSTRAINT "products_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "products_storeId_sku_key" ON "products"("storeId", "sku");
CREATE INDEX "products_storeId_status_idx" ON "products"("storeId", "status");
CREATE INDEX "products_storeId_name_idx" ON "products"("storeId", "name");
COMMENT ON COLUMN "products"."deletedAt" IS 'Soft delete — audit history matters for products; hard-deleted only on GDPR erasure.';
COMMENT ON COLUMN "products"."attributes" IS 'Free-form JSONB (fashion sizes, IMEI, expiry…) surfaced to AI answers.';

CREATE TABLE "product_variants" (
    "id"                TEXT            NOT NULL,
    "productId"         TEXT            NOT NULL,
    "sku"               TEXT            NOT NULL,
    "name"              TEXT            NOT NULL, -- "50kg" | "Red · XL"
    "price"             DECIMAL(14,2),            -- NULL ⇒ inherit product.price
    "costPrice"         DECIMAL(14,2),
    "stockQuantity"     INTEGER         NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER         NOT NULL DEFAULT 5,
    "trackStock"        BOOLEAN         NOT NULL DEFAULT true,
    "attributes"        JSONB           NOT NULL DEFAULT '{}'::jsonb,
    "imageUrl"          TEXT,
    "status"            "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt"         TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)    NOT NULL,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_variants_price_nonneg_check" CHECK ("price" IS NULL OR "price" >= 0),
    CONSTRAINT "product_variants_stock_nonneg_check" CHECK ("stockQuantity" >= 0),
    CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "product_variants_productId_sku_key" ON "product_variants"("productId", "sku");
CREATE INDEX "product_variants_productId_status_idx" ON "product_variants"("productId", "status");
COMMENT ON TABLE "product_variants" IS 'Size/color/bundle variants. Parent stockQuantity mirrors SUM(variants) maintained by inventory service.';

-- =============================================================================
-- CUSTOMERS & ORDERS
-- =============================================================================

CREATE TABLE "customers" (
    "id"             TEXT          NOT NULL,
    "storeId"        TEXT          NOT NULL,
    "waPhone"        TEXT          NOT NULL,   -- E.164 normalized (+23480…)
    "name"           TEXT,
    "email"          TEXT,
    "tags"           TEXT[]        NOT NULL DEFAULT '{}'::text[],
    "segment"        TEXT,                       -- VIP|REPEAT|NEW|CHURN_RISK (AI-computed)
    "sentiment"      "Sentiment",
    "totalSpent"     DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ordersCount"    INTEGER       NOT NULL DEFAULT 0,
    "lastOrderAt"    TIMESTAMP(3),
    "lastSeenAt"     TIMESTAMP(3),
    "marketingOptIn" BOOLEAN       NOT NULL DEFAULT false,
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customers_waphone_e164_check" CHECK ("waPhone" ~ '^\+[1-9][0-9]{6,14}$'),
    CONSTRAINT "customers_totals_nonneg_check" CHECK ("totalSpent" >= 0 AND "ordersCount" >= 0),
    CONSTRAINT "customers_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "customers_storeId_waPhone_key" ON "customers"("storeId", "waPhone");
CREATE INDEX "customers_storeId_totalSpent_idx" ON "customers"("storeId", "totalSpent");
CREATE INDEX "customers_storeId_lastOrderAt_idx" ON "customers"("storeId", "lastOrderAt");
COMMENT ON COLUMN "customers"."waPhone" IS 'WhatsApp identity. Same human can exist per-store — cross-store linkage is derived, not stored.';
COMMENT ON COLUMN "customers"."segment" IS 'Recomputed nightly by segmentation job; cached read model for campaign targeting.';

CREATE TABLE "orders" (
    "id"                 TEXT           NOT NULL,
    "storeId"            TEXT           NOT NULL,
    "customerId"         TEXT           NOT NULL,
    "orderNumber"        TEXT           NOT NULL, -- WC-7F3K9Q human reference
    "status"             "OrderStatus"  NOT NULL DEFAULT 'PENDING_PAYMENT',
    "channel"            "OrderChannel" NOT NULL DEFAULT 'WHATSAPP',
    "subtotal"           DECIMAL(14,2)  NOT NULL,
    "discount"           DECIMAL(14,2)  NOT NULL DEFAULT 0,
    "deliveryFee"        DECIMAL(14,2)  NOT NULL DEFAULT 0,
    "total"              DECIMAL(14,2)  NOT NULL,
    "currency"           "Currency"     NOT NULL DEFAULT 'NGN',
    "paymentReference"   TEXT,
    "deliveryAddress"    TEXT,
    "deliveryCity"       TEXT,
    "notes"              TEXT,
    "paidAt"             TIMESTAMP(3),
    "shippedAt"          TIMESTAMP(3),
    "deliveredAt"        TIMESTAMP(3),
    "cancelledAt"        TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt"          TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)   NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_amounts_nonneg_check" CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "deliveryFee" >= 0 AND "total" >= 0),
    CONSTRAINT "orders_total_math_check" CHECK ("total" = "subtotal" - "discount" + "deliveryFee"),
    CONSTRAINT "orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE INDEX "orders_storeId_status_createdAt_idx" ON "orders"("storeId", "status", "createdAt");
CREATE INDEX "orders_storeId_customerId_createdAt_idx" ON "orders"("storeId", "customerId", "createdAt");
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");
COMMENT ON CONSTRAINT "orders_total_math_check" ON "orders" IS 'Database-level guarantee that totals are internally consistent — corrupt money math fails loudly at write time.';

CREATE TABLE "order_items" (
    "id"          TEXT          NOT NULL,
    "orderId"     TEXT          NOT NULL,
    "productId"   TEXT          NOT NULL,
    "variantId"   TEXT,
    "productName" TEXT          NOT NULL, -- snapshot: catalog renames must not rewrite history
    "variantName" TEXT,
    "sku"         TEXT,                   -- snapshot of SKU at purchase time
    "quantity"    INTEGER       NOT NULL,
    "unitPrice"   DECIMAL(14,2) NOT NULL,
    "note"        TEXT,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_items_quantity_positive_check" CHECK ("quantity" > 0),
    CONSTRAINT "order_items_unit_price_nonneg_check" CHECK ("unitPrice" >= 0),
    CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");
CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");

-- =============================================================================
-- PAYMENTS & LOGISTICS
-- =============================================================================

CREATE TABLE "payments" (
    "id"                TEXT             NOT NULL,
    "storeId"           TEXT             NOT NULL,
    "orderId"           TEXT,                          -- NULL until linked (pay-first flows)
    "provider"          "PaymentProvider" NOT NULL,
    "providerReference" TEXT             NOT NULL,     -- PSP transaction id — webhook dedupe key
    "amount"            DECIMAL(14,2)    NOT NULL,
    "fee"               DECIMAL(14,2)    NOT NULL DEFAULT 0,
    "currency"          "Currency"       NOT NULL DEFAULT 'NGN',
    "status"            "PaymentStatus"  NOT NULL DEFAULT 'INITIALIZED',
    "checkoutUrl"       TEXT,
    "failureReason"     TEXT,
    "meta"              JSONB            NOT NULL DEFAULT '{}'::jsonb,
    "initializedAt"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt"            TIMESTAMP(3),
    "refundedAt"        TIMESTAMP(3),
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_amount_nonneg_check" CHECK ("amount" >= 0 AND "fee" >= 0),
    CONSTRAINT "payments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "payments_providerReference_key" ON "payments"("providerReference");
CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");
CREATE INDEX "payments_storeId_status_idx" ON "payments"("storeId", "status");
-- Prisma emits this plain index in addition to the UNIQUE above (@@index([providerReference])).
CREATE INDEX "payments_providerReference_idx" ON "payments"("providerReference");
COMMENT ON COLUMN "payments"."providerReference" IS 'UNIQUE — idempotency anchor for PSP webhook replays.';

-- Platform-global logistics partner registry (seeded by ops, not per-tenant).
CREATE TABLE "delivery_providers" (
    "id"                  TEXT          NOT NULL,
    "code"                TEXT          NOT NULL,   -- GIG | KWIK | SENDY | …
    "name"                TEXT          NOT NULL,
    "countries"           TEXT[]        NOT NULL DEFAULT '{}'::text[],
    "cities"              TEXT[]        NOT NULL DEFAULT '{}'::text[], -- empty = nationwide
    "baseFee"             DECIMAL(14,2) NOT NULL,
    "perKmFee"            DECIMAL(14,2) NOT NULL DEFAULT 0,
    "avgEtaMinutes"       INTEGER,
    "credentialsEncrypted" BYTEA,                    -- AES-256-GCM envelope (app layer)
    "webhookSecretHash"   TEXT,
    "isActive"            BOOLEAN       NOT NULL DEFAULT true,
    "meta"                JSONB         NOT NULL DEFAULT '{}'::jsonb,
    "createdAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)  NOT NULL,
    CONSTRAINT "delivery_providers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "delivery_providers_fees_nonneg_check" CHECK ("baseFee" >= 0 AND "perKmFee" >= 0)
);
CREATE UNIQUE INDEX "delivery_providers_code_key" ON "delivery_providers"("code");
COMMENT ON TABLE "delivery_providers" IS 'Operational config for carrier integrations; deliveries.carrier keeps a stable snapshot code.';

CREATE TABLE "deliveries" (
    "id"                 TEXT              NOT NULL,
    "storeId"            TEXT              NOT NULL,
    "orderId"            TEXT              NOT NULL,  -- 1:1 with orders
    "deliveryProviderId" TEXT,
    "carrier"            "LogisticsCarrier" NOT NULL DEFAULT 'MANUAL', -- denormalized snapshot of provider.code
    "trackingCode"       TEXT,
    "status"             "DeliveryStatus"  NOT NULL DEFAULT 'QUOTED',
    "pickupAddress"      TEXT,
    "dropoffAddress"     TEXT,
    "recipientName"      TEXT,
    "recipientPhone"     TEXT,
    "fee"                DECIMAL(14,2),
    "etaMinutes"         INTEGER,
    "quotedAt"           TIMESTAMP(3),
    "bookedAt"           TIMESTAMP(3),
    "pickedUpAt"         TIMESTAMP(3),
    "deliveredAt"        TIMESTAMP(3),
    "failedAt"           TIMESTAMP(3),
    "failureReason"      TEXT,
    "proofUrl"           TEXT,                          -- POD photo/signature (S3 key)
    "meta"               JSONB             NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "deliveries_fee_nonneg_check" CHECK ("fee" IS NULL OR "fee" >= 0),
    CONSTRAINT "deliveries_eta_positive_check" CHECK ("etaMinutes" IS NULL OR "etaMinutes" > 0),
    -- E.164 when present (matches stores.whatsappNumber / customers.waPhone)
    CONSTRAINT "deliveries_recipientPhone_e164_check"
        CHECK ("recipientPhone" IS NULL OR "recipientPhone" ~ '^\+[1-9][0-9]{6,14}$'),
    CONSTRAINT "deliveries_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "deliveries_deliveryProviderId_fkey" FOREIGN KEY ("deliveryProviderId") REFERENCES "delivery_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "deliveries_orderId_key" ON "deliveries"("orderId");
CREATE INDEX "deliveries_storeId_status_idx" ON "deliveries"("storeId", "status");
CREATE INDEX "deliveries_trackingCode_idx" ON "deliveries"("trackingCode");
CREATE INDEX "deliveries_deliveryProviderId_status_idx" ON "deliveries"("deliveryProviderId", "status");
COMMENT ON COLUMN "deliveries"."carrier" IS 'Snapshot for history/display; live FK is deliveryProviderId. MANUAL = seller self-delivers.';

-- =============================================================================
-- MESSAGING
-- =============================================================================

-- One thread per (store, customer). Exposed to SQL/BI consumers additionally
-- as view `message_threads` (0002).
CREATE TABLE "conversations" (
    "id"                TEXT                 NOT NULL,
    "storeId"           TEXT                 NOT NULL,
    "customerId"        TEXT                 NOT NULL,
    "waPhone"           TEXT                 NOT NULL, -- denormalized hot-path identity
    "status"            "ConversationStatus" NOT NULL DEFAULT 'BOT',
    "botEnabled"        BOOLEAN              NOT NULL DEFAULT true,
    "assignedUserId"    TEXT,
    "unreadCount"       INTEGER              NOT NULL DEFAULT 0,
    "lastMessageAt"     TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" TEXT,
    "createdAt"         TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)         NOT NULL,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "conversations_unread_nonneg_check" CHECK ("unreadCount" >= 0),
    CONSTRAINT "conversations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conversations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "conversations_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "conversations_storeId_customerId_key" ON "conversations"("storeId", "customerId");
CREATE INDEX "conversations_storeId_lastMessageAt_idx" ON "conversations"("storeId", "lastMessageAt");
CREATE INDEX "conversations_storeId_status_idx" ON "conversations"("storeId", "status");
COMMENT ON COLUMN "conversations"."status" IS 'BOT = AI owns replies · HANDLED = human agent · CLOSED = terminal.';

-- Hottest table. Converted to monthly RANGE partitions (or Timescale hypertable)
-- in production via infra/db/postgres/post-migrate.sql; >90d rows archived.
CREATE TABLE "messages" (
    "id"             TEXT               NOT NULL,
    "conversationId" TEXT               NOT NULL,
    "direction"      "MessageDirection" NOT NULL,
    "type"           "MessageType"      NOT NULL DEFAULT 'TEXT',
    "body"           TEXT,
    "mediaUrl"       TEXT,
    "templateName"   TEXT,
    "waMessageId"    TEXT,                             -- provider id — webhook dedupe key
    "status"         "MessageStatus"    NOT NULL DEFAULT 'QUEUED',
    "sentByBot"      BOOLEAN            NOT NULL DEFAULT false,
    "errorReason"    TEXT,
    "createdAt"      TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "messages_waMessageId_key" ON "messages"("waMessageId");
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");
CREATE INDEX "messages_status_createdAt_idx" ON "messages"("status", "createdAt");
COMMENT ON COLUMN "messages"."waMessageId" IS 'UNIQUE — Meta/Twilio retries must not duplicate rows.';

-- =============================================================================
-- MARKETING AUTOMATION
-- =============================================================================

CREATE TABLE "automation_rules" (
    "id"            TEXT                NOT NULL,
    "storeId"       TEXT                NOT NULL,
    "trigger"       "AutomationTrigger" NOT NULL,
    "conditions"    JSONB               NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"minCartValue":5000}
    "messageBody"   TEXT                NOT NULL,
    "delayMinutes"  INTEGER             NOT NULL DEFAULT 0,
    "isEnabled"     BOOLEAN             NOT NULL DEFAULT true,
    "priority"      INTEGER             NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)        NOT NULL,
    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "automation_rules_delay_nonneg_check" CHECK ("delayMinutes" >= 0),
    CONSTRAINT "automation_rules_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "automation_rules_storeId_trigger_isEnabled_idx" ON "automation_rules"("storeId", "trigger", "isEnabled");

CREATE TABLE "campaigns" (
    "id"             TEXT              NOT NULL,
    "storeId"        TEXT              NOT NULL,
    "type"           "CampaignType"    NOT NULL,
    "name"           TEXT              NOT NULL,
    "audienceFilter" JSONB             NOT NULL DEFAULT '{}'::jsonb, -- {"tags":["VIP"],"minOrders":2}
    "messageBody"    TEXT              NOT NULL,
    "scheduledFor"   TIMESTAMP(3),
    "startedAt"      TIMESTAMP(3),
    "completedAt"    TIMESTAMP(3),
    "status"         "CampaignStatus"  NOT NULL DEFAULT 'DRAFT',
    "statsSent"      INTEGER           NOT NULL DEFAULT 0,
    "statsDelivered" INTEGER           NOT NULL DEFAULT 0,
    "statsReplied"   INTEGER           NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "campaigns_stats_nonneg_check" CHECK ("statsSent" >= 0 AND "statsDelivered" >= 0 AND "statsReplied" >= 0),
    CONSTRAINT "campaigns_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "campaigns_storeId_status_idx" ON "campaigns"("storeId", "status");

CREATE TABLE "campaign_messages" (
    "id"          TEXT         NOT NULL,
    "campaignId"  TEXT         NOT NULL,
    "customerId"  TEXT         NOT NULL,
    "status"      TEXT         NOT NULL DEFAULT 'queued', -- queued|sent|delivered|replied|failed
    "messageId"   TEXT,
    "errorReason" TEXT,
    "sentAt"      TIMESTAMP(3),
    CONSTRAINT "campaign_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "campaign_messages_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "campaign_messages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "campaign_messages_campaignId_status_idx" ON "campaign_messages"("campaignId", "status");

-- =============================================================================
-- AI OUTPUTS & CONFIGURATION
-- =============================================================================

CREATE TABLE "price_suggestions" (
    "id"             TEXT          NOT NULL,
    "storeId"        TEXT          NOT NULL,
    "productId"      TEXT          NOT NULL,
    "currentPrice"   DECIMAL(14,2) NOT NULL,
    "suggestedPrice" DECIMAL(14,2) NOT NULL,
    "confidence"     DECIMAL(3,2)  NOT NULL,
    "reason"         TEXT          NOT NULL,
    "factors"        JSONB         NOT NULL DEFAULT '{}'::jsonb,
    "status"         TEXT          NOT NULL DEFAULT 'PENDING', -- PENDING|APPROVED|DISMISSED|EXPIRED
    "expiresAt"      TIMESTAMP(3),
    "appliedAt"      TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "price_suggestions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "price_suggestions_confidence_range_check" CHECK ("confidence" BETWEEN 0 AND 1),
    CONSTRAINT "price_suggestions_prices_positive_check" CHECK ("currentPrice" >= 0 AND "suggestedPrice" >= 0),
    CONSTRAINT "price_suggestions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "price_suggestions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "price_suggestions_storeId_status_idx" ON "price_suggestions"("storeId", "status");

CREATE TABLE "demand_forecasts" (
    "id"             TEXT         NOT NULL,
    "storeId"        TEXT         NOT NULL,
    "productId"      TEXT         NOT NULL,
    "forecastDate"   TIMESTAMP(3) NOT NULL,   -- DATE grain
    "predictedDemand" INTEGER    NOT NULL,
    "actualDemand"   INTEGER,
    "confidence"     DECIMAL(3,2) NOT NULL,
    "modelVersion"   TEXT         NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demand_forecasts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "demand_forecasts_confidence_range_check" CHECK ("confidence" BETWEEN 0 AND 1),
    CONSTRAINT "demand_forecasts_demand_nonneg_check" CHECK ("predictedDemand" >= 0 AND ("actualDemand" IS NULL OR "actualDemand" >= 0)),
    CONSTRAINT "demand_forecasts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "demand_forecasts_productId_forecastDate_key" ON "demand_forecasts"("productId", "forecastDate");
CREATE INDEX "demand_forecasts_storeId_forecastDate_idx" ON "demand_forecasts"("storeId", "forecastDate");

-- Per-store AI brain settings. The auto-responder loads this every turn and
-- caches it in Redis keyed by store id.
CREATE TABLE "ai_configurations" (
    "id"                   TEXT         NOT NULL,
    "storeId"              TEXT         NOT NULL,
    "isEnabled"            BOOLEAN      NOT NULL DEFAULT true,
    "tone"                 "AiTone"     NOT NULL DEFAULT 'FRIENDLY',
    "languages"            TEXT[]       NOT NULL DEFAULT '{en,pcm}'::text[],
    "businessContext"      TEXT,                    -- seller FAQ/policies fed into prompts
    "autoReplyEnabled"     BOOLEAN      NOT NULL DEFAULT true,
    "workingHours"         JSONB        NOT NULL DEFAULT '{}'::jsonb, -- {"start":"08:00","end":"20:00","days":[1,2,3,4,5,6]}
    "outOfOfficeBody"      TEXT,
    "escalationKeywords"   TEXT[]       NOT NULL DEFAULT '{}'::text[],
    "primaryModel"         TEXT         NOT NULL DEFAULT 'claude-3-haiku-20240307',
    "fallbackModel"        TEXT         NOT NULL DEFAULT 'gpt-4o-mini',
    "temperature"          DECIMAL(3,2) NOT NULL DEFAULT 0.7,
    "maxTokens"            INTEGER      NOT NULL DEFAULT 512,
    "dailyTokenBudget"     INTEGER      NOT NULL DEFAULT 200000,
    "semanticCacheEnabled" BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_configurations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_configurations_temperature_range_check" CHECK ("temperature" BETWEEN 0 AND 1),
    CONSTRAINT "ai_configurations_maxtokens_positive_check" CHECK ("maxTokens" > 0),
    CONSTRAINT "ai_configurations_budget_positive_check" CHECK ("dailyTokenBudget" > 0),
    CONSTRAINT "ai_configurations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ai_configurations_storeId_key" ON "ai_configurations"("storeId");
COMMENT ON COLUMN "ai_configurations"."dailyTokenBudget" IS 'COGS guardrail enforced in Redis counters (INCR+EXPIRE) before each generation.';

-- Reusable response templates. storeId NULL ⇒ platform-provided system template.
CREATE TABLE "ai_responses" (
    "id"           TEXT                 NOT NULL,
    "storeId"      TEXT,
    "category"     "AiTemplateCategory" NOT NULL DEFAULT 'CUSTOM',
    "templateName" TEXT                 NOT NULL,
    "body"         TEXT                 NOT NULL,
    "variables"    TEXT[]               NOT NULL DEFAULT '{}'::text[],
    "language"     TEXT                 NOT NULL DEFAULT 'en',
    "isActive"     BOOLEAN              NOT NULL DEFAULT true,
    "priority"     INTEGER              NOT NULL DEFAULT 0,
    "usageCount"   INTEGER              NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)         NOT NULL,
    CONSTRAINT "ai_responses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_responses_usage_nonneg_check" CHECK ("usageCount" >= 0),
    CONSTRAINT "ai_responses_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ai_responses_storeId_templateName_key" ON "ai_responses"("storeId", "templateName"); -- NULL store rows exempt by SQL NULL semantics
CREATE INDEX "ai_responses_category_language_isActive_idx" ON "ai_responses"("category", "language", "isActive");

-- =============================================================================
-- ANALYTICS & COMPLIANCE
-- =============================================================================

-- Append-only behavioral event stream → drained into daily rollups + ClickHouse.
-- Production converts this to monthly partitions / Timescale hypertable.
CREATE TABLE "analytics_events" (
    "id"         BIGSERIAL    NOT NULL,
    "storeId"    TEXT         NOT NULL,
    "customerId" TEXT,
    "sessionId"  TEXT,
    "type"       TEXT         NOT NULL,   -- order.created | message.replied | cart.abandoned …
    "props"      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "analytics_events_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "analytics_events_storeId_type_occurredAt_idx" ON "analytics_events"("storeId", "type", "occurredAt");
CREATE INDEX "analytics_events_occurredAt_idx" ON "analytics_events"("occurredAt");
COMMENT ON TABLE "analytics_events" IS 'Append-only. No UPDATE grants to wco_app; retention 13 months then archived to S3 Parquet.';

CREATE TABLE "daily_store_metrics" (
    "id"                 TEXT          NOT NULL,
    "storeId"            TEXT          NOT NULL,
    "date"               TIMESTAMP(3)  NOT NULL,   -- DATE grain (00:00 UTC)
    "revenue"            DECIMAL(16,2) NOT NULL DEFAULT 0,
    "ordersCount"        INTEGER       NOT NULL DEFAULT 0,
    "newCustomers"       INTEGER       NOT NULL DEFAULT 0,
    "messagesCount"      INTEGER       NOT NULL DEFAULT 0,
    "aiResolutionRate"   DECIMAL(5,4)  NOT NULL DEFAULT 0,
    "avgResponseSeconds" DECIMAL(8,1)  NOT NULL DEFAULT 0,
    "conversionRate"     DECIMAL(5,4)  NOT NULL DEFAULT 0,
    CONSTRAINT "daily_store_metrics_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "daily_store_metrics_rates_range_check" CHECK ("aiResolutionRate" BETWEEN 0 AND 1 AND "conversionRate" BETWEEN 0 AND 1),
    CONSTRAINT "daily_store_metrics_counts_nonneg_check" CHECK ("ordersCount" >= 0 AND "newCustomers" >= 0 AND "messagesCount" >= 0),
    CONSTRAINT "daily_store_metrics_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "daily_store_metrics_storeId_date_key" ON "daily_store_metrics"("storeId", "date");
COMMENT ON TABLE "daily_store_metrics" IS 'Rollup target of the 02:00 WAT aggregation cron + realtime incremental upserts.';

-- Transactional outbox (ADR-002): domain events written atomically with state
-- changes; relay publishes to RabbitMQ then stamps processedAt.
CREATE TABLE "outbox_events" (
    "id"            TEXT         NOT NULL,
    "aggregateType" TEXT         NOT NULL,   -- order | payment | shipment | conversation
    "aggregateId"   TEXT         NOT NULL,
    "eventType"     TEXT         NOT NULL,   -- see @wco/shared events catalog
    "payload"       JSONB        NOT NULL,
    "processedAt"   TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbox_events_payload_json_check" CHECK (jsonb_typeof("payload") = 'object')
);
CREATE INDEX "outbox_events_processedAt_createdAt_idx" ON "outbox_events"("processedAt", "createdAt");

-- Merchant-facing outgoing webhooks (WCO → merchant systems). HMAC-SHA256
-- signed payloads; exponential backoff retries.
CREATE TABLE "webhook_subscriptions" (
    "id"        TEXT         NOT NULL,
    "storeId"   TEXT         NOT NULL,
    "url"       TEXT         NOT NULL,
    "secret"    TEXT         NOT NULL,     -- HMAC signing key (KMS-backed in prod)
    "events"    TEXT[]       NOT NULL DEFAULT '{}'::text[], -- empty = all events
    "isActive"  BOOLEAN      NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "webhook_subscriptions_url_https_check" CHECK ("url" ~* '^https://'),
    CONSTRAINT "webhook_subscriptions_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "webhook_subscriptions_storeId_isActive_idx" ON "webhook_subscriptions"("storeId", "isActive");

-- Append-only audit trail. No UPDATE/DELETE grants for the app role.
CREATE TABLE "audit_logs" (
    "id"          TEXT         NOT NULL,
    "storeId"     TEXT,                      -- NULL = platform-level action
    "actorUserId" TEXT,                      -- NULL = system actor
    "actorIp"     TEXT,
    "action"      TEXT         NOT NULL,     -- auth.login | product.update | payout.request …
    "resource"    TEXT         NOT NULL,
    "resourceId"  TEXT,
    "before"      JSONB,
    "after"       JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_action_required_check" CHECK (length("action") > 0),
    CONSTRAINT "audit_logs_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "audit_logs_storeId_createdAt_idx" ON "audit_logs"("storeId", "createdAt");
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");
COMMENT ON TABLE "audit_logs" IS 'Immutable trail — app role has INSERT+SELECT only; tampering requires explicit ops intervention which is itself alerted on.';

-- =============================================================================
-- END OF 0001 — security hardening continues in 0002_security_rls_functions
-- =============================================================================
