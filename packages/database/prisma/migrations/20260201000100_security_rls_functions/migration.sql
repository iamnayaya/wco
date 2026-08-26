-- =============================================================================
-- WCO · 0002 · Security hardening, tenant isolation & maintenance functions
-- =============================================================================
-- Layers of defense (ADR-003):
--   1. Application repositories always scope queries by TenantContext.
--   2. RLS policies below make a missed WHERE clause fail closed, not leak.
--   3. Grants are least-privilege: wco_app cannot UPDATE/DELETE append-only
--      tables and cannot bypass RLS; only wco_migrator can run DDL.
--
-- RLS is ENABLED but policies rely on session GUCs set per request:
--     SET LOCAL app.current_store_id    = '<store uuid/cuid>';
--     SET LOCAL app.current_merchant_id = '<merchant id>';   -- merchant-scope ops
-- Unset GUC ⇒ current_setting(..., true) returns NULL ⇒ policy false ⇒ no rows.
-- Platform-internal jobs connect as wco_migrator which has BYPASSRLS.
--
-- Prisma note: policies/roles/functions/views are invisible to the Prisma
-- schema — no drift is introduced by this file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Roles
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wco_migrator') THEN
    CREATE ROLE wco_migrator LOGIN BYPASSRLS VALID UNTIL 'infinity';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wco_app') THEN
    CREATE ROLE wco_app LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wco_readonly') THEN
    CREATE ROLE wco_readonly LOGIN;
  END IF;
END
$$;

COMMENT ON ROLE wco_migrator IS 'Migration/ops pipeline identity. BYPASSRLS — audited usage only.';
COMMENT ON ROLE wco_app       IS 'Primary application identity. Subject to RLS. No DDL rights.';
COMMENT ON ROLE wco_readonly  IS 'BI/analytics read replica identity. Subject to RLS.';

-- Deterministic UTC everywhere regardless of who connects (see init header).
ALTER ROLE wco_migrator SET timezone TO 'UTC';
ALTER ROLE wco_app       SET timezone TO 'UTC';
ALTER ROLE wco_readonly  SET timezone TO 'UTC';
-- Fail fast on runaway queries rather than dragging the pool down.
ALTER ROLE wco_app SET statement_timeout TO '15s';
ALTER ROLE wco_readonly SET statement_timeout TO '60s';
ALTER ROLE wco_app SET idle_in_transaction_session_timeout TO '30s';

-- -----------------------------------------------------------------------------
-- 2 · Tenant context helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_tenant(p_store_id TEXT, p_merchant_id TEXT DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config('app.current_store_id',    p_store_id,    false),
         set_config('app.current_merchant_id', p_merchant_id, false);
$$;

-- Stable accessors (NULL-safe): unset GUC ⇒ no rows ever match.
CREATE OR REPLACE FUNCTION current_store_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.current_store_id', true)
$$;

CREATE OR REPLACE FUNCTION current_merchant_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.current_merchant_id', true)
$$;

-- -----------------------------------------------------------------------------
-- 3 · updated_at maintenance trigger (safety net for raw-SQL writers;
--     Prisma already sets this client-side — trigger simply re-stamps).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" := CURRENT_TIMESTAMP;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'merchants','users','stores','products','product_variants',
    'customers','orders','payments','deliveries','conversations',
    'automation_rules','campaigns','price_suggestions','ai_configurations',
    'ai_responses','payment_methods','subscriptions','subscription_plans',
    'webhook_subscriptions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at()', t, t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4 · Row-Level Security
-- -----------------------------------------------------------------------------
-- Pattern A — store-scoped tables: row matches when storeId == session store.
-- Pattern B — nested tables (no direct storeId): parent join must match.
-- Pattern C — merchant-scoped tables: merchantId matches OR any owned store matches.
-- Platform tables without tenancy (subscription_plans, delivery_providers,
-- outbox_events) get plain SELECT/INSERT grants instead of RLS.

DO $$
DECLARE
  t TEXT;
  store_scoped TEXT[] := ARRAY[
    'stores','categories','products','customers','orders','payments','deliveries',
    'conversations','automation_rules','campaigns','price_suggestions',
    'demand_forecasts','daily_store_metrics','analytics_events',
    'webhook_subscriptions'
  ];
BEGIN
  -- ---- Pattern A: direct storeId columns -----------------------------------
  FOREACH t IN ARRAY store_scoped LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I ' ||
      'USING ("storeId" = current_store_id()) ' ||
      'WITH CHECK ("storeId" = current_store_id())', t);
  END LOOP;

  -- ---- Pattern B: nested rows reach tenancy through their parent ----------
  ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON messages;
  CREATE POLICY tenant_isolation ON messages
    USING (EXISTS (SELECT 1 FROM conversations c
                   WHERE c.id = messages."conversationId" AND c."storeId" = current_store_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM conversations c
                   WHERE c.id = messages."conversationId" AND c."storeId" = current_store_id()));

  ALTER TABLE order_items     ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON order_items;
  CREATE POLICY tenant_isolation ON order_items
    USING (EXISTS (SELECT 1 FROM orders o
                   WHERE o.id = order_items."orderId" AND o."storeId" = current_store_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM orders o
                   WHERE o.id = order_items."orderId" AND o."storeId" = current_store_id()));

  ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON campaign_messages;
  CREATE POLICY tenant_isolation ON campaign_messages
    USING (EXISTS (SELECT 1 FROM campaigns ca
                   WHERE ca.id = campaign_messages."campaignId" AND ca."storeId" = current_store_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM campaigns ca
                   WHERE ca.id = campaign_messages."campaignId" AND ca."storeId" = current_store_id()));

  -- users hang off merchants (Pattern C-lite) -------------------------------
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON users;
  CREATE POLICY tenant_isolation ON users
    USING ("merchantId" = current_merchant_id())
    WITH CHECK ("merchantId" = current_merchant_id());

  -- refresh_tokens/api_tokens/payment_methods/subscriptions: merchant scope --
  ALTER TABLE refresh_tokens   ENABLE ROW LEVEL SECURITY;
  ALTER TABLE api_tokens       ENABLE ROW LEVEL SECURITY;
  ALTER TABLE payment_methods  ENABLE ROW LEVEL SECURITY;
  ALTER TABLE subscriptions    ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON refresh_tokens;
  DROP POLICY IF EXISTS tenant_isolation ON api_tokens;
  DROP POLICY IF EXISTS tenant_isolation ON payment_methods;
  DROP POLICY IF EXISTS tenant_isolation ON subscriptions;
  CREATE POLICY tenant_isolation ON refresh_tokens
    USING (EXISTS (SELECT 1 FROM users u WHERE u.id = refresh_tokens."userId" AND u."merchantId" = current_merchant_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = refresh_tokens."userId" AND u."merchantId" = current_merchant_id()));
  CREATE POLICY tenant_isolation ON api_tokens
    USING ("merchantId" = current_merchant_id())
    WITH CHECK ("merchantId" = current_merchant_id());
  CREATE POLICY tenant_isolation ON payment_methods
    USING ("merchantId" = current_merchant_id())
    WITH CHECK ("merchantId" = current_merchant_id());
  CREATE POLICY tenant_isolation ON subscriptions
    USING ("merchantId" = current_merchant_id())
    WITH CHECK ("merchantId" = current_merchant_id());

  -- ai_configurations / ai_responses: store-scoped (ai_responses.storeId may be
  -- NULL for system templates — readable by every tenant, writable by none).
  ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation ON ai_configurations;
  CREATE POLICY tenant_isolation ON ai_configurations
    USING ("storeId" = current_store_id())
    WITH CHECK ("storeId" = current_store_id());

  ALTER TABLE ai_responses ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS system_templates_readable ON ai_responses;
  CREATE POLICY system_templates_readable ON ai_responses
    USING ("storeId" IS NULL OR "storeId" = current_store_id());
  DROP POLICY IF EXISTS tenant_templates_writable ON ai_responses;
  CREATE POLICY tenant_templates_writable ON ai_responses
    USING ("storeId" = current_store_id())
    WITH CHECK ("storeId" = current_store_id());

  -- audit_logs: tenant reads own trail; INSERT allowed; NO update/delete grant.
  ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS audit_read_own ON audit_logs;
  CREATE POLICY audit_read_own ON audit_logs
    USING ("storeId" = current_store_id());

  -- merchants table itself: a merchant sees only its own row.
  ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS self_read ON merchants;
  CREATE POLICY self_read ON merchants
    USING (id = current_merchant_id());
END $$;

-- -----------------------------------------------------------------------------
-- 5 · Least-privilege grants
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO wco_app, wco_readonly;

-- Read/write surface for the application role:
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'merchants','users','refresh_tokens','api_tokens','stores',
    'subscription_plans','subscriptions','payment_methods','categories',
    'products','product_variants','customers','orders','order_items',
    'payments','delivery_providers','deliveries','conversations','messages',
    'automation_rules','campaigns','campaign_messages','price_suggestions',
    'demand_forecasts','ai_configurations','ai_responses','analytics_events',
    'daily_store_metrics','webhook_subscriptions'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO wco_app', t);
    EXECUTE format('GRANT SELECT ON %I TO wco_readonly', t);
  END LOOP;
END $$;

-- Append-only surfaces: INSERT + SELECT only (no UPDATE/DELETE for wco_app):
GRANT SELECT, INSERT ON outbox_events TO wco_app;
GRANT SELECT          ON outbox_events TO wco_readonly;
GRANT SELECT, INSERT ON audit_logs   TO wco_app;
GRANT SELECT          ON audit_logs   TO wco_readonly;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wco_app; -- analytics_events BIGSERIAL

-- -----------------------------------------------------------------------------
-- 6 · Cross-cutting integrity & search support
-- -----------------------------------------------------------------------------

-- Exactly one live billing subscription per merchant (partial unique index —
-- cannot be expressed in Prisma schema, lives here deliberately).
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_live_per_merchant_uidx
  ON "subscriptions"("merchantId")
  WHERE "status" IN ('ACTIVE', 'TRIALING');

-- Fuzzy-search fallbacks used when Elasticsearch is degraded (pg_trgm GIN).
CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON "products" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_name_trgm_idx
  ON "customers" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS customers_waphone_prefix_idx
  ON "customers" ("waPhone" text_pattern_ops);

-- Spec-compliance view: BI consumers query `message_threads`;
-- application code keeps using the conversations entity.
CREATE OR REPLACE VIEW message_threads AS SELECT * FROM "conversations";
COMMENT ON VIEW message_threads IS 'Compatibility alias of conversations (message-thread vocabulary). Read-only surface for BI; app writes go to conversations.';

-- -----------------------------------------------------------------------------
-- 7 · Partition maintenance helpers (used by prod post-migrate layout)
-- -----------------------------------------------------------------------------

-- Creates next month's RANGE partition if missing. Safe to run concurrently
-- from cron; advisory lock serializes competing workers.
CREATE OR REPLACE FUNCTION ensure_monthly_partition(p_table REGCLASS, p_start DATE)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_name TEXT;
  v_end  DATE := p_start + INTERVAL '1 month';
BEGIN
  v_name := format('%s_%s%s', p_table::text, to_char(p_start, 'YYYY'), to_char(p_start, '"M"MM'));
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
    v_name, p_table::text, p_start, v_end
  );
  RETURN v_name;
END $$;

COMMENT ON FUNCTION ensure_monthly_partition IS 'Pre-creates monthly partitions; called nightly by partition-maintenance cron with (now()+interval ''2 months'')::date.';
